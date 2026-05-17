// Yahoo Finance via direct HTTP to v8 chart endpoint.
// More reliable than yahoo-finance2 in serverless — no library quirks.

export interface Quote {
  symbol: string;
  shortName: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
  regularMarketTime: number;
}

interface YahooMeta {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  currency?: string;
  marketState?: string;
  regularMarketTime?: number;
}

async function fetchOne(symbol: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        // Yahoo blocks default Node UA — pretend to be a browser
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 300 }, // 5 min cache
    });
    if (!res.ok) {
      console.error(`[stocks] ${symbol} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const meta: YahooMeta | undefined = data?.chart?.result?.[0]?.meta;
    if (!meta) {
      console.error(`[stocks] ${symbol} no meta in response`, JSON.stringify(data).slice(0, 200));
      return null;
    }
    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = price - prev;
    const changePercent = prev > 0 ? (change / prev) * 100 : 0;
    return {
      symbol: meta.symbol,
      shortName: meta.shortName ?? meta.longName ?? meta.symbol,
      price,
      previousClose: prev,
      change,
      changePercent,
      currency: meta.currency ?? "USD",
      marketState: meta.marketState ?? "CLOSED",
      regularMarketTime: meta.regularMarketTime ?? 0,
    };
  } catch (e) {
    console.error(`[stocks] ${symbol} threw`, e);
    return null;
  }
}

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];
  const results = await Promise.all(tickers.map((t) => fetchOne(t)));
  return results.filter((r): r is Quote => r !== null);
}
