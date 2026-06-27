import { getCurrentUserId } from "@/lib/supabase/auth-utils";

const INDICES = [
  { key: "dow",     symbol: "^DJI",  label: "DOW" },
  { key: "nasdaq",  symbol: "^IXIC", label: "NASDAQ" },
  { key: "sp500",   symbol: "^GSPC", label: "S&P 500" },
];

function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(); // 0=Sun 6=Sat
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 570 && mins < 960; // 9:30–16:00 ET
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const results = await Promise.all(
    INDICES.map(async ({ key, symbol, label }) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; morrisai/1.0)" },
          next: { revalidate: 60 }, // 60-second cache
        });
        if (!res.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;

        const price: number = meta.regularMarketPrice ?? 0;
        const prev: number = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change: number = price - prev;
        const changePct: number = prev ? (change / prev) * 100 : 0;

        return {
          key,
          label,
          price,
          change,
          changePct,
          direction: change >= 0 ? "up" : "down",
        };
      } catch {
        return null;
      }
    })
  );

  return Response.json({
    indices: results.filter(Boolean),
    marketOpen: isMarketOpen(),
  });
}
