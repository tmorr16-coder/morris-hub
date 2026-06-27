import { getStockCandles } from "@/lib/finnhub";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const resolution = (searchParams.get("resolution") || "D") as "D" | "60" | "1";
  const days = parseInt(searchParams.get("days") || "30");

  if (!ticker) return Response.json({ error: "Ticker required" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;

  const candles = await getStockCandles(ticker, resolution, from, now);
  if (!candles) return Response.json({ error: "No data" }, { status: 404 });

  const points = candles.t.map((t, i) => ({
    time: t * 1000,
    close: candles.c[i],
    high: candles.h[i],
    low: candles.l[i],
    open: candles.o[i],
    volume: candles.v[i],
  }));

  return Response.json({ ticker, points });
}
