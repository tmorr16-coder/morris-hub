import { getCurrentUserId } from "@/lib/supabase/auth-utils";

// Yahoo Finance v8 chart API — free, no key required
const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

interface CandlePoint {
  time: number; // ms
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const range = searchParams.get("range") || "1mo";
  const interval = searchParams.get("interval") || "1d";

  if (!ticker) return Response.json({ error: "Ticker required" }, { status: 400 });

  const url = `${YF_BASE}/${ticker}?interval=${interval}&range=${range}`;

  let raw: Record<string, unknown>;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; morrisai-research/1.0)" },
      next: { revalidate: 300 },
    });
    raw = await res.json();
  } catch (err) {
    console.error("[candle] Yahoo Finance fetch failed:", err);
    return Response.json({ error: "Chart data unavailable" }, { status: 502 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (raw as any).chart?.result?.[0];
  if (!result?.timestamp) {
    console.error("[candle] No result from Yahoo Finance:", ticker, range);
    return Response.json({ error: "No chart data" }, { status: 404 });
  }

  const timestamps: number[] = result.timestamp;
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes: (number | null)[] = quote.close ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows: (number | null)[] = quote.low ?? [];
  const opens: (number | null)[] = quote.open ?? [];
  const volumes: (number | null)[] = quote.volume ?? [];

  const points: CandlePoint[] = timestamps
    .map((t, i) => ({
      time: t * 1000,
      close: closes[i] ?? 0,
      high: highs[i] ?? 0,
      low: lows[i] ?? 0,
      open: opens[i] ?? 0,
      volume: volumes[i] ?? 0,
    }))
    .filter((p) => p.close > 0);

  return Response.json({ ticker, points });
}
