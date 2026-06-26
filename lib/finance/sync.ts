import { plaidClient } from '@/lib/finance/plaid';
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
 * Syncs one Plaid item using /transactions/sync (cursor-based, incremental).
 * Updates transactions, refreshes balances, snapshots daily balance, logs to audit.
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
    let cursor: string | undefined = item.sync_cursor ?? undefined;
    let hasMore = true;
    const added: any[] = [];
    const modified: any[] = [];
    const removed: any[] = [];

    while (hasMore) {
      const { data } = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      added.push(...data.added);
      modified.push(...data.modified);
      removed.push(...data.removed);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    // Map plaid_account_id -> internal account.id
    const { data: accounts } = await supabase
      .schema('finance')
      .from('accounts')
      .select('id, plaid_account_id')
      .eq('item_id', item.id);

    const accountMap = new Map<string, string>(
      (accounts ?? []).map((a) => [a.plaid_account_id, a.id])
    );

    // Upsert added + modified
    const txRows = [...added, ...modified]
      .map((tx) => ({
        account_id: accountMap.get(tx.account_id),
        plaid_transaction_id: tx.transaction_id,
        amount: tx.amount,
        iso_currency_code: tx.iso_currency_code,
        date: tx.date,
        authorized_date: tx.authorized_date,
        merchant_name: tx.merchant_name,
        name: tx.name,
        payment_channel: tx.payment_channel,
        pending: tx.pending,
        category: tx.category,
        personal_finance_category: tx.personal_finance_category,
        location: tx.location,
      }))
      .filter((tx) => tx.account_id);

    if (txRows.length > 0) {
      await supabase
        .schema('finance')
        .from('transactions')
        .upsert(txRows, { onConflict: 'plaid_transaction_id' });
    }

    // Remove deleted transactions
    if (removed.length > 0) {
      await supabase
        .schema('finance')
        .from('transactions')
        .delete()
        .in(
          'plaid_transaction_id',
          removed.map((r) => r.transaction_id)
        );
    }

    // Refresh balances + snapshot
    const { data: balData } = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    });
    const today = new Date().toISOString().slice(0, 10);

    for (const acct of balData.accounts) {
      const internalId = accountMap.get(acct.account_id);
      if (!internalId) continue;

      await supabase
        .schema('finance')
        .from('accounts')
        .update({
          current_balance: acct.balances.current,
          available_balance: acct.balances.available,
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
            current_balance: acct.balances.current,
            available_balance: acct.balances.available,
          },
          { onConflict: 'account_id,snapshot_date' }
        );
    }

    // Update item cursor + last_synced_at
    await supabase
      .schema('finance')
      .from('plaid_items')
      .update({ sync_cursor: cursor ?? null, last_synced_at: new Date().toISOString() })
      .eq('id', item.id);

    // Audit
    await supabase.schema('finance').from('audit_log').insert({
      user_id: item.user_id,
      action: 'plaid_sync',
      resource_type: 'item',
      resource_id: item.id,
      metadata: { added: added.length, modified: modified.length, removed: removed.length },
    });

    return {
      item_id: item.id,
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    };
  } catch (error: any) {
    const msg = error?.response?.data?.error_code ?? error?.message ?? 'unknown';
    console.error(`[sync] item ${itemId} failed:`, msg);

    // Mark item if Plaid says login is required
    if (msg === 'ITEM_LOGIN_REQUIRED') {
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
