import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/finance/plaid';
import { encrypt } from '@/lib/finance/encryption';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { public_token, institution } = await req.json();

  if (!public_token) {
    return NextResponse.json({ error: 'public_token required' }, { status: 400 });
  }

  try {
    // 1. Exchange public_token for long-lived access_token
    const { data: exchange } = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = exchange.access_token;
    const itemId = exchange.item_id;

    // 2. Store encrypted item record (service role — bypasses RLS for writes)
    const service = createServiceClient();

    const { data: itemRow, error: itemErr } = await service
      .schema('finance')
      .from('plaid_items')
      .insert({
        user_id: user.id,
        plaid_item_id: itemId,
        institution_id: institution?.institution_id ?? 'unknown',
        institution_name: institution?.name ?? 'Unknown',
        access_token_encrypted: encrypt(accessToken),
      })
      .select()
      .single();

    if (itemErr) throw itemErr;

    // 3. Pull initial accounts and store them
    const { data: acctData } = await plaidClient.accountsGet({ access_token: accessToken });

    const accountRows = acctData.accounts.map((a) => ({
      item_id: itemRow.id,
      plaid_account_id: a.account_id,
      name: a.name,
      official_name: a.official_name ?? null,
      type: a.type,
      subtype: a.subtype ?? null,
      mask: a.mask ?? null,
      current_balance: a.balances.current,
      available_balance: a.balances.available,
      iso_currency_code: a.balances.iso_currency_code ?? 'USD',
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
      metadata: { institution: institution?.name, accounts: accountRows.length },
    });

    return NextResponse.json({ success: true, item_id: itemRow.id, redirectTo: '/finance/dashboard' });
  } catch (error: unknown) {
    const errObj = error as { response?: { data?: unknown }; message?: string };
    console.error('[exchange]', errObj.response?.data ?? errObj.message);
    return NextResponse.json({ error: 'failed to exchange token' }, { status: 500 });
  }
}
