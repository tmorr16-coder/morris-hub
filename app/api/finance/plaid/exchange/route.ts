import { NextRequest, NextResponse } from 'next/server';
import { exchangeSetupToken, getAccounts } from '@/lib/finance/simplefin';
import { encrypt } from '@/lib/finance/encryption';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Simplefin Bridge: Exchange setup token for access token
 *
 * Called after user authenticates at claim URL and is redirected with ?setup=SETUP_TOKEN
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { setup_token, institution_name } = await req.json();

  if (!setup_token) {
    return NextResponse.json({ error: 'setup_token required' }, { status: 400 });
  }

  try {
    // 1. Exchange setup token for permanent access token
    const { access_token: accessToken } = await exchangeSetupToken(setup_token);

    // 2. Store encrypted item record (service role — bypasses RLS for writes)
    const service = createServiceClient();

    const { data: itemRow, error: itemErr } = await service
      .schema('finance')
      .from('plaid_items')
      .insert({
        user_id: user.id,
        plaid_item_id: accessToken, // In Simplefin, access token serves as the item ID
        institution_id: 'simplefin',
        institution_name: institution_name ?? 'Bank Connection',
        access_token_encrypted: encrypt(accessToken),
        status: 'active',
      })
      .select()
      .single();

    if (itemErr) throw itemErr;

    // 3. Pull initial accounts and store them
    const accounts = await getAccounts(accessToken);

    const accountRows = accounts.map((a) => ({
      item_id: itemRow.id,
      plaid_account_id: a.id,
      name: a.name,
      official_name: a.name, // Simplefin doesn't have separate official name
      type: a.type,
      subtype: null, // Simplefin doesn't provide subtype
      mask: null, // Simplefin doesn't provide mask
      current_balance: a.balance,
      available_balance: a.available_balance ?? a.balance,
      iso_currency_code: a.currency ?? 'USD',
      balance_as_of: new Date().toISOString(),
    }));

    if (accountRows.length > 0) {
      await service.schema('finance').from('accounts').insert(accountRows);
    }

    // 4. Audit
    await service.schema('finance').from('audit_log').insert({
      user_id: user.id,
      action: 'plaid_exchange',
      resource_type: 'item',
      resource_id: itemRow.id,
      metadata: { institution: institution_name, accounts: accountRows.length },
    });

    return NextResponse.json({ success: true, item_id: itemRow.id, redirectTo: '/finance/dashboard' });
  } catch (error: unknown) {
    const errObj = error as { message?: string };
    console.error('[exchange]', errObj.message);
    return NextResponse.json({ error: 'failed to exchange token: ' + errObj.message }, { status: 500 });
  }
}
