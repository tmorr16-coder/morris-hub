import { NextRequest, NextResponse } from 'next/server';
import { syncAllItems, syncItem } from '@/lib/finance/sync';
import { createServiceClient } from '@/lib/supabase/server';
import { evaluateBudgets, usersWithBudgets } from '@/lib/finance/budgets';

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
  // Fresh transactions are the moment a budget can be crossed. Each alert is
  // keyed per month, so this pass raises only what is new, and a failure here
  // must not turn a successful sync into a failed cron.
  const budgets: Record<string, number> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = createServiceClient() as any;
    const today = new Date().toISOString().slice(0, 10);
    for (const userId of await usersWithBudgets(svc)) {
      const r = await evaluateBudgets(svc, userId, today).catch(() => null);
      if (r) budgets[userId] = r.fired.length;
    }
  } catch { /* reported in the body below as empty */ }
  return NextResponse.json({ synced: results, budgetAlerts: budgets });
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
