import { NextResponse } from 'next/server';
import { createClaimUrl } from '@/lib/finance/simplefin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Simplefin Bridge: Create claim URL for bank authentication
 *
 * Simplefin flow:
 * 1. Create claim URL
 * 2. User visits claim URL and authenticates with their bank
 * 3. User is redirected back to our app with setup token
 * 4. We exchange setup token for permanent access token
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 });
    }

    // Create claim URL that user will visit to authenticate
    const redirectUrl = `${appUrl}/finance/connect/callback`;
    const { claim_url } = await createClaimUrl(redirectUrl);

    return NextResponse.json({ claim_url });
  } catch (error: unknown) {
    const errObj = error as { message?: string };
    console.error('[link-token]', errObj.message);
    return NextResponse.json({ error: 'failed to create claim URL' }, { status: 500 });
  }
}
