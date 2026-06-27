import { getBasicFinancials, getCompanyProfile } from "@/lib/finnhub";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

function formatMarketCap(capInMillions: number): string {
  if (capInMillions >= 1_000_000) return `$${(capInMillions / 1_000_000).toFixed(2)}T`;
  if (capInMillions >= 1_000) return `$${(capInMillions / 1_000).toFixed(2)}B`;
  return `$${capInMillions.toFixed(0)}M`;
}

function formatVolume(volInMillions: number): string {
  const vol = volInMillions * 1_000_000;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(0)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return `${vol}`;
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return Response.json({ error: "Ticker required" }, { status: 400 });

  const [metrics, profile] = await Promise.all([
    getBasicFinancials(ticker),
    getCompanyProfile(ticker),
  ]);

  const m = metrics || {};
  const weekHigh52 = m["52WeekHigh"] ?? null;
  const weekLow52 = m["52WeekLow"] ?? null;
  const avgVolRaw = m["10DayAverageTradingVolume"] ?? null;
  const peRatio = m["peBasicExclExtraTTM"] ?? m["peNormalizedAnnual"] ?? null;
  const marketCap = profile?.marketCapitalization
    ? formatMarketCap(profile.marketCapitalization)
    : null;
  const avgVolume = avgVolRaw !== null ? formatVolume(avgVolRaw) : null;
  const exchange = profile?.exchange ?? null;

  return Response.json({ ticker, weekHigh52, weekLow52, avgVolume, peRatio, marketCap, exchange });
}
