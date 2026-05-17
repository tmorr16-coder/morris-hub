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

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

async function fetchOne(symbol: string): Promise<Quote | null> {
  // Yahoo aggressively rate-limits Vercel datacenter IPs. Try both edge
  // hosts (query1 + query2) before giving up — different load balancers
  // see different cache state and one often succeeds when the other 429s.
  let lastErr: string | null = null;
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
        next: { revalidate: 300 }, // 5 min cache
      });
      if (!res.ok) {
        lastErr = `${host} HTTP ${res.status}`;
        continue; // try next host
      }
      const data = await res.json();
      const meta: YahooMeta | undefined = data?.chart?.result?.[0]?.meta;
      if (!meta) {
        lastErr = `${host} no meta`;
        continue;
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
      lastErr = `${host} threw ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
  }
  console.error(`[stocks] ${symbol} failed:`, lastErr);
  return null;
}

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];
  const results = await Promise.all(tickers.map((t) => fetchOne(t)));
  return results.filter((r): r is Quote => r !== null);
}
