import { NextRequest, NextResponse, after } from 'next/server';
import { createHash } from 'crypto';
import { importJWK, jwtVerify, type JWK } from 'jose';
import { plaidClient } from '@/lib/finance/plaid';
import { syncItem } from '@/lib/finance/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Cache Plaid's JWK public keys (they rotate periodically)
const keyCache = new Map<string, { jwk: JWK; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getPlaidPublicKey(kid: string): Promise<JWK> {
  const cached = keyCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.jwk;
  }
  const { data } = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
  const jwk = data.key as unknown as JWK;
  keyCache.set(kid, { jwk, fetchedAt: Date.now() });
  return jwk;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signedJwt = req.headers.get('plaid-verification');

  if (!signedJwt) {
    return NextResponse.json({ error: 'missing signature' }, { status: 401 });
  }

  try {
    // Decode header (without verifying) to get the key id
    const [headerB64] = signedJwt.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));

    if (header.alg !== 'ES256') {
      return NextResponse.json({ error: 'unsupported alg' }, { status: 401 });
    }

    const jwk = await getPlaidPublicKey(header.kid);
    const publicKey = await importJWK(jwk, 'ES256');

    const { payload } = await jwtVerify(signedJwt, publicKey, { algorithms: ['ES256'] });

    // Verify the body hash matches what Plaid signed
    const bodyHash = createHash('sha256').update(rawBody).digest('hex');
    if (payload.request_body_sha256 !== bodyHash) {
      return NextResponse.json({ error: 'body hash mismatch' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // SYNC_UPDATES_AVAILABLE is the modern transactions webhook (paired with /transactions/sync)
    if (
      event.webhook_type === 'TRANSACTIONS' &&
      (event.webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
        event.webhook_code === 'INITIAL_UPDATE' ||
        event.webhook_code === 'DEFAULT_UPDATE' ||
        event.webhook_code === 'HISTORICAL_UPDATE')
    ) {
      // Look up internal item id by Plaid item_id
      const { createServiceClient } = await import('@/lib/supabase/server');
      const supabase = createServiceClient();
      const { data: item } = await supabase
        .schema('finance')
        .from('plaid_items')
        .select('id')
        .eq('plaid_item_id', event.item_id)
        .single();

      if (item) {
        // Schedule sync to run AFTER the response is sent. Without `after()`,
        // the serverless function terminates and kills the in-flight Plaid
        // call ("socket hang up"). With `after()`, Vercel keeps the function
        // alive up to maxDuration so the sync can complete.
        const itemId = item.id;
        after(async () => {
          try {
            await syncItem(itemId);
          } catch (e) {
            console.error('[webhook sync]', e);
          }
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const msg = (error as { message?: string }).message ?? error;
    console.error('[webhook]', msg);
    return NextResponse.json({ error: 'invalid webhook' }, { status: 401 });
  }
}
