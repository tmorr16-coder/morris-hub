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
import { clearFailures } from '@/lib/system-events';

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

    // 3. Best-effort initial pull. The connection is saved either way — the
    //    setup token is single-use and must not be wasted on a pull failure.
    //    But a failure here is NOT reported as a clean success: swallowing it
    //    produced the worst outcome of all, an institution connected with zero
    //    accounts and nothing anywhere saying why.
    let pullError: string | null = null;
    try {
      await pullAccounts(service, itemRow.id, user.id, accessUrl);

      // A successful initial pull IS a sync, and nothing was recording it as
      // one — only syncItem set last_synced_at. So a bank connected at noon
      // read as "never synced" until the 09:00 cron the next morning, which
      // the status page and the dashboard both correctly reported as a problem
      // with a connection that was in fact working perfectly.
      await service
        .schema('finance')
        .from('plaid_items')
        .update({
          last_synced_at: new Date().toISOString(),
          status: 'active',
          last_error: null,
          last_error_at: null,
        })
        .eq('id', itemRow.id);
      await clearFailures('simplefin', itemRow.id);
    } catch (pullErr) {
      pullError = (pullErr as { message?: string })?.message ?? 'unknown';
      console.error('[simplefin/claim] initial pull failed (connection saved):', pullError);

      // Record it on the item so the dashboard and settings show the state
      // immediately, rather than looking healthy until the next nightly sync.
      try {
        await service
          .schema('finance')
          .from('plaid_items')
          .update({ status: 'error', last_error: pullError.slice(0, 300), last_error_at: new Date().toISOString() })
          .eq('id', itemRow.id);
      } catch { /* the pull failure is the thing worth reporting */ }
    }

    return NextResponse.json({
      success: true,
      item_id: itemRow.id,
      redirectTo: '/finance/dashboard',
      ...(pullError ? { warning: explainClaimFailure(pullError) } : {}),
    });
  } catch (error: unknown) {
    // Never log the access URL or setup token.
    const msg = (error as { message?: string })?.message ?? 'unknown';
    console.error('[simplefin/claim]', msg);

    // Say what actually went wrong. These messages come from our own throw
    // sites in lib/finance/simplefin.ts and lib/finance/encryption.ts and carry
    // no credential — returning a single generic string for all of them meant a
    // reused token, a malformed one and an unset encryption key were
    // indistinguishable from the outside, and none of them were actionable.
    return NextResponse.json({ error: 'failed to connect SimpleFIN', reason: explainClaimFailure(msg) }, { status: 500 });
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


/**
 * Turn an internal failure into something the person connecting can act on.
 *
 * The most common one by far is a reused setup token: they are single-use, so a
 * second attempt with the same token always 403s — and the old generic message
 * sent people looking for a fault in the app instead of fetching a new token.
 */
function explainClaimFailure(msg: string): string {
  if (/status 40[13]/.test(msg)) {
    return 'That setup token has already been used or has expired. SimpleFIN tokens are single-use — generate a fresh one and paste it in.';
  }
  if (/status 4\d\d/.test(msg)) {
    return 'SimpleFIN rejected that setup token. Check it was copied in full, then try a new one.';
  }
  if (/status 5\d\d/.test(msg)) {
    return 'SimpleFIN is having trouble at their end. The token is still good — try again in a few minutes.';
  }
  if (/timed out|aborted|timeout/i.test(msg)) {
    return 'SimpleFIN did not respond in time. The token is still good — try again.';
  }
  if (/base64|https claim URL|Setup token is required/i.test(msg)) {
    return 'That does not look like a SimpleFIN setup token. Copy the whole token from SimpleFIN and paste it again.';
  }
  if (/TOKEN_ENCRYPTION_KEY/.test(msg)) {
    return 'The server is missing its encryption key, so the connection cannot be stored securely. This is a configuration problem, not something you can fix here.';
  }
  return 'Something went wrong saving the connection. The setup token may still be unused — try again, and generate a new one if it fails twice.';
}
