import { fetchSimpleFinAccounts, mapSimpleFinAccount, mapSimpleFinTransaction } from '@/lib/finance/simplefin';
import { decrypt } from '@/lib/finance/encryption';
import { createServiceClient } from '@/lib/supabase/server';
import { recordFailure, clearFailures } from '@/lib/system-events';

type SyncResult = {
  item_id: string;
  added: number;
  modified: number;
  removed: number;
  error?: string;
};

/**
 * Syncs one SimpleFIN connection (stored as a finance.plaid_items row).
 * Fetches a rolling 90-day window of accounts + embedded transactions from the
 * SimpleFIN access URL, upserts transactions, refreshes balances, and snapshots.
 */
export async function syncItem(itemId: string): Promise<SyncResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

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
    const accessUrl = decrypt(item.access_token_encrypted);
    const startDate = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
    const { accounts, providerErrors } = await fetchSimpleFinAccounts(accessUrl, startDate);

    // SimpleFIN reports per-connection trouble in an `errors` array and simply
    // OMITS the accounts it could not reach. Both callers destructured only
    // `accounts`, so a bank that needed re-authorising looked like a completely
    // successful sync that happened to return fewer accounts — which is exactly
    // how accounts go missing with nothing anywhere saying why.
    if (providerErrors.length > 0) {
      await recordFailure({
        source: 'simplefin',
        subject: itemId,
        userId: item.user_id ?? null,
        severity: 'warning',
        message: `SimpleFIN reported ${providerErrors.length} connection problem${providerErrors.length === 1 ? '' : 's'}: ${providerErrors.join(' · ')}`,
        detail: { providerErrors, accountsReturned: accounts.length },
      });
    }

    // Map SimpleFIN account id -> internal account id; insert any newly-appeared
    // accounts. Tombstones (deleted_at set) are read too, and deliberately kept
    // out of the map: a deleted account must not be re-created here, or the
    // delete would quietly undo itself on the next sync.
    const { data: existing } = await supabase
      .schema('finance')
      .from('accounts')
      .select('id, plaid_account_id, deleted_at')
      .eq('item_id', item.id);

    const existingRows = (existing ?? []) as { id: string; plaid_account_id: string; deleted_at: string | null }[];
    const deletedExternalIds = new Set(
      existingRows.filter((a) => a.deleted_at).map((a) => a.plaid_account_id)
    );
    const accountMap = new Map<string, string>(
      existingRows.filter((a) => !a.deleted_at).map((a) => [a.plaid_account_id, a.id])
    );

    const insertFailures: string[] = [];
    for (const a of accounts) {
      if (deletedExternalIds.has(a.id)) continue; // stays deleted
      if (accountMap.has(a.id)) continue;
      const { data: inserted, error: insertErr } = await supabase
        .schema('finance')
        .from('accounts')
        .insert({ item_id: item.id, ...mapSimpleFinAccount(a) })
        .select('id')
        .single();
      // This error used to be discarded: `const { data: inserted } = ...` and
      // then `if (inserted?.id)`. An account that failed to insert was skipped
      // silently on every sync, for ever, with nothing written anywhere — a
      // second way for an account to simply never appear.
      if (insertErr) {
        insertFailures.push(`${a.org?.name ?? 'unknown'} · ${a.name}: ${insertErr.message}`);
        continue;
      }
      if (inserted?.id) accountMap.set(a.id, inserted.id);
    }

    if (insertFailures.length > 0) {
      await recordFailure({
        source: 'simplefin',
        subject: itemId,
        userId: item.user_id ?? null,
        severity: 'warning',
        message: `${insertFailures.length} account${insertFailures.length === 1 ? '' : 's'} could not be saved: ${insertFailures.join(' · ')}`,
        detail: { insertFailures },
      });
    }

    // Name the connection after every institution behind it, not after
    // whichever account happened to be first in the array. A SimpleFIN access
    // URL commonly spans several banks — that is what the Bridge is for — and
    // naming the item `accounts[0].org.name` filed every other institution's
    // accounts under the wrong heading.
    const orgNames = [...new Set(accounts.map((a) => a.org?.name).filter(Boolean) as string[])];
    if (orgNames.length > 0) {
      const label = orgNames.length === 1 ? orgNames[0] : `${orgNames.length} institutions`;
      if (label !== item.institution_name) {
        await supabase
          .schema('finance')
          .from('plaid_items')
          .update({ institution_name: label })
          .eq('id', itemId);
      }
    }

    // The two loops below both resolve through accountMap and skip on a miss,
    // so tombstones fall out there too — no balance refresh, no transactions
    // written against a deleted account.

    // Upsert transactions (embedded in each account). Amounts are sign-flipped to
    // this codebase's convention inside mapSimpleFinTransaction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txRows: any[] = [];
    for (const a of accounts) {
      const internalId = accountMap.get(a.id);
      if (!internalId) continue;
      const currency = a.currency ?? 'USD';
      for (const t of a.transactions ?? []) {
        txRows.push({ account_id: internalId, ...mapSimpleFinTransaction(a.id, currency, t) });
      }
    }

    let totalAdded = 0;
    if (txRows.length > 0) {
      // scoping-ok: txRows are built for the item being synced (this user's)
      await supabase
        .schema('finance')
        .from('transactions')
        .upsert(txRows, { onConflict: 'plaid_transaction_id' });
      totalAdded = txRows.length;
    }

    // Refresh balances + daily snapshot.
    const today = new Date().toISOString().slice(0, 10);
    for (const a of accounts) {
      const internalId = accountMap.get(a.id);
      if (!internalId) continue;
      const mapped = mapSimpleFinAccount(a);

      await supabase
        .schema('finance')
        .from('accounts')
        .update({
          type: mapped.type, // keep category (cash/credit/loan/investment) in sync with inferType
          current_balance: mapped.current_balance,
          available_balance: mapped.available_balance,
          balance_as_of: mapped.balance_as_of,
        })
        .eq('id', internalId);

      await supabase
        .schema('finance')
        .from('balance_snapshots')
        .upsert(
          {
            account_id: internalId,
            snapshot_date: today,
            current_balance: mapped.current_balance,
            available_balance: mapped.available_balance,
          },
          { onConflict: 'account_id,snapshot_date' }
        );
    }

    // Carry the fresh balances through to the retirement plan. Retirement
    // accounts linked to a live account only ever updated when someone opened
    // the retirement page and pressed Refresh — the nightly sync refreshed the
    // dashboard and left the plan reading last month's numbers. The link is by
    // internal account id, so this touches only rows pointing at accounts on
    // the item being synced.
    for (const a of accounts) {
      const internalId = accountMap.get(a.id);
      if (!internalId) continue;
      const { current_balance } = mapSimpleFinAccount(a);
      if (current_balance == null || Number.isNaN(current_balance)) continue;
      // scoping-ok: keyed on this item's own account ids
      await supabase
        .schema('finance')
        .from('retirement_accounts')
        .update({ balance: current_balance })
        .eq('plaid_account_id', internalId);
    }

    await supabase
      .schema('finance')
      .from('plaid_items')
      .update({
        last_synced_at: new Date().toISOString(),
        status: 'active',
        last_error: null,
        last_error_at: null,
      })
      .eq('id', item.id);

    await clearFailures('simplefin', itemId);

    await supabase.schema('finance').from('audit_log').insert({
      user_id: item.user_id,
      action: 'simplefin_sync',
      resource_type: 'item',
      resource_id: item.id,
      metadata: { added: totalAdded, modified: 0, removed: 0 },
    });

    return { item_id: item.id, added: totalAdded, modified: 0, removed: 0 };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    console.error(`[sync] item ${itemId} failed:`, msg);

    // Write the failure down. Previously this was console-only, so the row kept
    // reporting 'active' and a connection could be broken for weeks with nothing
    // in the interface saying so. The message comes from our own throw sites and
    // never carries the access URL; truncated anyway as a belt-and-braces.
    try {
      await supabase
        .schema('finance')
        .from('plaid_items')
        .update({
          status: 'error',
          last_error: msg.slice(0, 300),
          last_error_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    } catch { /* the sync failure is the thing worth reporting, not this */ }

    await recordFailure({
      source: 'simplefin',
      subject: itemId,
      userId: item.user_id ?? null,
      message: msg,
      detail: { institution: item.institution_name ?? null },
    });

    return { item_id: itemId, added: 0, modified: 0, removed: 0, error: msg };
  }
}

/**
 * Sync all active items (used by the daily cron).
 */
export async function syncAllItems(): Promise<SyncResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  // Errored items are included deliberately: most failures are transient, and
  // selecting only 'active' would mean one bad day retired a connection for
  // good with no way back except reconnecting.
  // scoping-ok: cron job — intentionally syncs every user's items
  const { data: items } = await supabase
    .schema('finance')
    .from('plaid_items')
    .select('id')
    .in('status', ['active', 'error']);

  const results: SyncResult[] = [];
  for (const item of (items ?? []) as { id: string }[]) {
    results.push(await syncItem(item.id));
  }
  return results;
}
