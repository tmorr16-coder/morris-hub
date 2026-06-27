import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const resolution = searchParams.get("resolution") || "D";
  const days = parseInt(searchParams.get("days") || "30");

  if (!ticker) return Response.json({ error: "Ticker required" }, { status: 400 });

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return Response.json({ error: "FINNHUB_API_KEY not set" }, { status: 500 });

  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;

  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;

  let data: Record<string, unknown>;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    console.error("[candle] fetch failed:", err);
    return Response.json({ error: "Finnhub fetch failed", detail: String(err) }, { status: 502 });
  }

  console.log(`[candle] ${ticker} resolution=${resolution} days=${days} status=${data.s} points=${Array.isArray(data.c) ? data.c.length : 0}`);

  if (data.s !== "ok" || !Array.isArray(data.t)) {
    return Response.json({ error: "No data", finnhubStatus: data.s, ticker, resolution, from, to: now }, { status: 404 });
  }

  const t = data.t as number[];
  const c = data.c as number[];
  const h = data.h as number[];
  const l = data.l as number[];
  const o = data.o as number[];
  const v = data.v as number[];

  const points = t.map((ts, i) => ({
    time: ts * 1000,
    close: c[i],
    high: h[i],
    low: l[i],
    open: o[i],
    volume: v[i],
  }));

  return Response.json({ ticker, points });
}
