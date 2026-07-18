import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { encrypt } from '@/lib/finance/encryption';
import {
  claimAccessUrl,
  fetchSimpleFinAccounts,
  mapSimpleFinAccount,
  mapSimpleFinTransaction,
} from '@/lib/finance/simplefin';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { setupToken } = await req.json();

  if (!setupToken || typeof setupToken !== 'string') {
    return NextResponse.json({ error: 'setupToken required' }, { status: 400 });
  }

  try {
    // 1. Claim the setup token → access URL (embeds credentials; store encrypted).
    //    A setup token is one-time, so once claimed we must persist the connection
    //    BEFORE anything that could fail — otherwise a later error wastes the token.
    const accessUrl = await claimAccessUrl(setupToken);

    const service = createServiceClient() as any;

    // 2. Store the connection immediately (encrypted access URL).
    const { data: itemRow, error: itemErr } = await service
      .schema('finance')
      .from('plaid_items')
      .insert({
        user_id: user.id,
        plaid_item_id: 'simplefin:' + randomUUID(),
        institution_id: 'simplefin',
        institution_name: 'SimpleFIN',
        access_token_encrypted: encrypt(accessUrl),
        status: 'active',
      })
      .select('id')
      .single();

    if (itemErr) throw itemErr;

    // 3. Best-effort initial pull. If it fails, the connection is saved and
    //    "Sync now" will retry — the token is not wasted.
    try {
      await pullAccounts(service, itemRow.id, user.id, accessUrl);
    } catch (pullErr) {
      console.error('[simplefin/claim] initial pull failed (connection saved, will sync):', (pullErr as { message?: string })?.message);
    }

    return NextResponse.json({ success: true, item_id: itemRow.id, redirectTo: '/finance/dashboard' });
  } catch (error: unknown) {
    // Never log the access URL or setup token.
    const msg = (error as { message?: string })?.message ?? 'unknown';
    console.error('[simplefin/claim]', msg);
    return NextResponse.json({ error: 'failed to connect SimpleFIN' }, { status: 500 });
  }
}

/** Fetch accounts + transactions and write them for a just-claimed connection. */
async function pullAccounts(service: any, itemId: string, userId: string, accessUrl: string) {
  {
    const { accounts } = await fetchSimpleFinAccounts(accessUrl);

    if (accounts[0]?.org?.name) {
      await service.schema('finance').from('plaid_items')
        .update({ institution_name: accounts[0].org.name }).eq('id', itemId);
    }

    // 4. Insert accounts.
    const accountRows = accounts.map((a) => ({
      item_id: itemId,
      ...mapSimpleFinAccount(a),
    }));

    if (accountRows.length > 0) {
      // scoping-ok: accountRows each carry item_id for this user's just-created item
      await service.schema('finance').from('accounts').insert(accountRows);
    }

    // 5. Build plaid_account_id → internal account.id map.
    const { data: insertedAccounts } = await service
      .schema('finance')
      .from('accounts')
      .select('id, plaid_account_id')
      .eq('item_id', itemId);

    const accountMap = new Map<string, string>(
      ((insertedAccounts ?? []) as { id: string; plaid_account_id: string }[]).map((a) => [
        a.plaid_account_id,
        a.id,
      ])
    );

    // 6. Insert transactions (upsert on unique plaid_transaction_id).
    const today = new Date().toISOString().slice(0, 10);
    const txRows: any[] = [];
    for (const a of accounts) {
      const internalId = accountMap.get(a.id);
      if (!internalId) continue;
      const currency = a.currency ?? 'USD';
      for (const t of a.transactions ?? []) {
        txRows.push({ account_id: internalId, ...mapSimpleFinTransaction(a.id, currency, t) });
      }
    }

    if (txRows.length > 0) {
      // scoping-ok: txRows are built from this user's accounts (unique plaid_transaction_id)
      await service
        .schema('finance')
        .from('transactions')
        .upsert(txRows, { onConflict: 'plaid_transaction_id' });
    }

    // 7. Snapshot today's balances.
    const snapshotRows = accounts
      .map((a) => {
        const internalId = accountMap.get(a.id);
        if (!internalId) return null;
        const mapped = mapSimpleFinAccount(a);
        return {
          account_id: internalId,
          snapshot_date: today,
          current_balance: mapped.current_balance,
          available_balance: mapped.available_balance,
        };
      })
      .filter(Boolean);

    if (snapshotRows.length > 0) {
      await service
        .schema('finance')
        .from('balance_snapshots')
        .upsert(snapshotRows, { onConflict: 'account_id,snapshot_date' });
    }

    // 8. Audit.
    await service.schema('finance').from('audit_log').insert({
      user_id: userId,
      action: 'simplefin_claim',
      resource_type: 'item',
      resource_id: itemId,
      metadata: { institution: accounts[0]?.org?.name ?? 'SimpleFIN', accounts: accountRows.length },
    });
  }
}
