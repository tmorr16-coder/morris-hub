// Finnhub API for real-time stock quotes.
// Free tier: 60 calls/min — plenty for 5 tickers cached every 5 min.

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

// Friendly display names for tickers we know about.
const TICKER_NAMES: Record<string, string> = {
  LLY:  "Eli Lilly",
  GOOGL: "Alphabet",
  GOOG:  "Alphabet",
  AMZN:  "Amazon",
  NVDA:  "NVIDIA",
  MSFT:  "Microsoft",
  AAPL:  "Apple",
  META:  "Meta",
  TSLA:  "Tesla",
  NFLX:  "Netflix",
  ORCL:  "Oracle",
};

interface FinnhubQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // % change
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
}

function isMarketOpen(): "OPEN" | "CLOSED" {
  const now = new Date();
  // US Eastern time approximation — offset from UTC
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const et = new Date(utc - 4 * 3_600_000); // UTC-4 (EDT); close enough for display
  const day = et.getDay();   // 0=Sun, 6=Sat
  const hour = et.getHours();
  const min = et.getMinutes();
  const minutesFromMidnight = hour * 60 + min;
  if (day === 0 || day === 6) return "CLOSED";
  if (minutesFromMidnight >= 570 && minutesFromMidnight < 960) return "OPEN"; // 9:30–16:00 ET
  return "CLOSED";
}

async function fetchOne(symbol: string, token: string): Promise<Quote | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    const res = await fetch(url, {
      next: { revalidate: 300 }, // 5 min cache
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error(`[stocks] Finnhub ${symbol} HTTP ${res.status}`);
      return null;
    }
    const q: FinnhubQuote = await res.json();
    if (!q.c || q.c === 0) {
      console.error(`[stocks] Finnhub ${symbol} returned zero price — invalid symbol?`);
      return null;
    }
    return {
      symbol,
      shortName: TICKER_NAMES[symbol.toUpperCase()] ?? symbol,
      price: q.c,
      previousClose: q.pc,
      change: q.d,
      changePercent: q.dp,
      currency: "USD",
      marketState: isMarketOpen(),
      regularMarketTime: q.t,
    };
  } catch (e) {
    console.error(`[stocks] Finnhub ${symbol} threw`, e);
    return null;
  }
}

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];
  const token = process.env.FINNHUB_API_KEY ?? "";
  if (!token) {
    console.error("[stocks] FINNHUB_API_KEY not set");
    return [];
  }
  const results = await Promise.all(tickers.map((t) => fetchOne(t, token)));
  return results.filter((r): r is Quote => r !== null);
}
