import { getAccounts, getTransactions, healthCheck } from '@/lib/finance/simplefin';
import { decrypt } from '@/lib/finance/encryption';
import { createServiceClient } from '@/lib/supabase/server';

type SyncResult = {
  item_id: string;
  added: number;
  modified: number;
  removed: number;
  error?: string;
};

/**
 * Syncs one Simplefin Bridge item.
 * Fetches transactions since last sync, refreshes balances, snapshots daily balance.
 */
export async function syncItem(itemId: string): Promise<SyncResult> {
  const supabase = createServiceClient();

  const { data: item, error: itemErr } = await supabase
    .schema('finance')
    .from('plaid_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) {
    return { item_id: itemId, added: 0, modified: 0, removed: 0, error: 'item not found' };
  }

  try {
    const accessToken = decrypt(item.access_token_encrypted);

    // Health check — verify token is still valid
    const isHealthy = await healthCheck(accessToken);
    if (!isHealthy) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }

    // Get all accounts
    const simplefinAccounts = await getAccounts(accessToken);

    if (!simplefinAccounts.length) {
      return { item_id: itemId, added: 0, modified: 0, removed: 0, error: 'no accounts found' };
    }

    // Map simplefin account id -> internal account id
    const { data: accounts } = await supabase
      .schema('finance')
      .from('accounts')
      .select('id, plaid_account_id')
      .eq('item_id', item.id);

    const accountMap = new Map<string, string>(
      (accounts ?? []).map((a) => [a.plaid_account_id, a.id])
    );

    let totalAdded = 0;

    // Fetch transactions for each account since last sync
    for (const sfAccount of simplefinAccounts) {
      const internalId = accountMap.get(sfAccount.id);
      if (!internalId) continue;

      // Get transactions since last sync (default to 30 days ago)
      const lastSync = item.last_synced_at ? new Date(item.last_synced_at) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const startDate = lastSync.toISOString().slice(0, 10);

      const txs = await getTransactions(accessToken, sfAccount.id, startDate);

      // Map Simplefin transactions to our schema
      const txRows = txs
        .map((tx) => ({
          account_id: internalId,
          plaid_transaction_id: tx.id, // Use Simplefin tx id as our transaction id
          amount: Math.abs(tx.amount),
          iso_currency_code: tx.currency ?? 'USD',
          date: tx.posted.slice(0, 10), // YYYY-MM-DD
          authorized_date: null,
          merchant_name: tx.merchant ?? null,
          name: tx.description,
          payment_channel: tx.type ?? 'other',
          pending: false, // Simplefin doesn't distinguish pending
          category: tx.tags?.join(',') ?? null,
          personal_finance_category: null,
          location: null,
        }))
        .filter((tx) => tx.account_id);

      if (txRows.length > 0) {
        await supabase
          .schema('finance')
          .from('transactions')
          .upsert(txRows, { onConflict: 'plaid_transaction_id' });

        totalAdded += txRows.length;
      }
    }

    // Update balances + snapshots
    const today = new Date().toISOString().slice(0, 10);

    for (const sfAccount of simplefinAccounts) {
      const internalId = accountMap.get(sfAccount.id);
      if (!internalId) continue;

      await supabase
        .schema('finance')
        .from('accounts')
        .update({
          current_balance: sfAccount.balance,
          available_balance: sfAccount.available_balance ?? sfAccount.balance,
          balance_as_of: new Date().toISOString(),
        })
        .eq('id', internalId);

      await supabase
        .schema('finance')
        .from('balance_snapshots')
        .upsert(
          {
            account_id: internalId,
            snapshot_date: today,
            current_balance: sfAccount.balance,
            available_balance: sfAccount.available_balance ?? sfAccount.balance,
          },
          { onConflict: 'account_id,snapshot_date' }
        );
    }

    // Update last_synced_at
    await supabase
      .schema('finance')
      .from('plaid_items')
      .update({ last_synced_at: new Date().toISOString(), status: 'active' })
      .eq('id', item.id);

    // Audit
    await supabase.schema('finance').from('audit_log').insert({
      user_id: item.user_id,
      action: 'plaid_sync',
      resource_type: 'item',
      resource_id: item.id,
      metadata: { added: totalAdded, modified: 0, removed: 0 },
    });

    return {
      item_id: item.id,
      added: totalAdded,
      modified: 0,
      removed: 0,
    };
  } catch (error: any) {
    const msg = error?.message ?? 'unknown';
    console.error(`[sync] item ${itemId} failed:`, msg);

    // Mark item if auth failed
    if (msg === 'INVALID_ACCESS_TOKEN') {
      await supabase
        .schema('finance')
        .from('plaid_items')
        .update({ status: 'login_required' })
        .eq('id', itemId);
    }

    return { item_id: itemId, added: 0, modified: 0, removed: 0, error: msg };
  }
}

/**
 * Sync all active items (used by daily cron).
 */
export async function syncAllItems(): Promise<SyncResult[]> {
  const supabase = createServiceClient();
  const { data: items } = await supabase
    .schema('finance')
    .from('plaid_items')
    .select('id')
    .eq('status', 'active');

  const results: SyncResult[] = [];
  for (const item of items ?? []) {
    results.push(await syncItem(item.id));
  }
  return results;
}
