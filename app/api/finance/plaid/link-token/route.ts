import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { plaidClient } from '@/lib/finance/plaid';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // OAuth institutions (Chase, Capital One) require redirect_uri to be
    // registered in the Plaid dashboard, so we gate that behind PLAID_USE_OAUTH.
    // Webhooks are NOT subject to that restriction in sandbox — we always pass
    // the webhook URL so Plaid sends transaction-update events.
    const useOAuth = process.env.PLAID_USE_OAUTH === 'true';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    const { data } = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'morrisai.family',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(appUrl ? { webhook: `${appUrl}/api/finance/plaid/webhook` } : {}),
      ...(useOAuth && appUrl ? { redirect_uri: `${appUrl}/oauth-callback` } : {}),
    });

    return NextResponse.json({ link_token: data.link_token });
  } catch (error: unknown) {
    const errObj = error as { response?: { data?: unknown }; message?: string };
    console.error('[link-token]', errObj.response?.data ?? errObj.message);
    return NextResponse.json({ error: 'failed to create link token' }, { status: 500 });
  }
}
