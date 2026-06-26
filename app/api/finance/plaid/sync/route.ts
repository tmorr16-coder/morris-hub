import { NextRequest, NextResponse } from 'next/server';
import { syncAllItems, syncItem } from '@/lib/finance/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET — invoked by Vercel Cron. Syncs all active items.
 * Authorized via the Authorization: Bearer ${CRON_SECRET} header that Vercel sends.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const results = await syncAllItems();
  return NextResponse.json({ synced: results });
}

/**
 * POST — invoked by webhook handler with { item_id }. Syncs one item.
 * Authorized via the same CRON_SECRET (since this is also an internal call).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { item_id } = await req.json();
  if (!item_id) {
    return NextResponse.json({ error: 'item_id required' }, { status: 400 });
  }
  const result = await syncItem(item_id);
  return NextResponse.json(result);
}
