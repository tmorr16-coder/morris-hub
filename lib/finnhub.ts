// Finnhub API integration for real-time stock data
// Free tier: 60 calls/minute, data delayed by 15 minutes

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export interface FinnhubQuote {
  c: number; // current price
  h: number; // high price of the day
  l: number; // low price of the day
  o: number; // open price
  pc: number; // previous close price
  t: number; // timestamp
  d?: number; // change
  dp?: number; // percent change
}

export interface FinnhubCompanyProfile {
  country?: string;
  currency?: string;
  estimateCurrency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number;
  name?: string;
  phone?: string;
  shareOutstanding?: number;
  ticker?: string;
  weburl?: string;
}

export async function getStockQuote(
  ticker: string
): Promise<FinnhubQuote | null> {
  if (!FINNHUB_API_KEY) {
    console.warn("FINNHUB_API_KEY not set, stock data unavailable");
    return null;
  }

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      console.error(`Finnhub API error for ${ticker}:`, response.statusText);
      return null;
    }

    const data = await response.json();

    // Finnhub returns empty object if ticker not found
    if (!data.c) {
      return null;
    }

    return data as FinnhubQuote;
  } catch (error) {
    console.error(`Failed to fetch quote for ${ticker}:`, error);
    return null;
  }
}

export async function getCompanyProfile(
  ticker: string
): Promise<FinnhubCompanyProfile | null> {
  if (!FINNHUB_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Finnhub returns empty object if ticker not found
    if (!data.ticker) {
      return null;
    }

    return data as FinnhubCompanyProfile;
  } catch (error) {
    console.error(`Failed to fetch profile for ${ticker}:`, error);
    return null;
  }
}

// ── Candles ──────────────────────────────────────────────────────────────────

export interface FinnhubCandle {
  c: number[]; // close prices
  h: number[];
  l: number[];
  o: number[];
  t: number[]; // unix seconds
  v: number[];
  s: string;   // "ok" | "no_data"
}

export async function getStockCandles(
  ticker: string,
  resolution: "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M",
  from: number,
  to: number
): Promise<FinnhubCandle | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const res = await fetch(
      `${FINNHUB_BASE_URL}/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.s !== "ok") return null;
    return data as FinnhubCandle;
  } catch {
    return null;
  }
}

// ── Basic Financials ─────────────────────────────────────────────────────────

export interface FinnhubMetrics {
  "52WeekHigh"?: number;
  "52WeekLow"?: number;
  "10DayAverageTradingVolume"?: number;
  "peBasicExclExtraTTM"?: number;
  "peNormalizedAnnual"?: number;
  [key: string]: number | undefined;
}

export async function getBasicFinancials(ticker: string): Promise<FinnhubMetrics | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const res = await fetch(
      `${FINNHUB_BASE_URL}/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.metric ?? null;
  } catch {
    return null;
  }
}

// ── Market News ───────────────────────────────────────────────────────────────

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export async function getMarketNews(): Promise<FinnhubNewsItem[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await fetch(
      `${FINNHUB_BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export async function searchSymbol(
  query: string
): Promise<
  Array<{
    displaySymbol: string;
    description: string;
    symbol: string;
    type: string;
  }>
> {
  if (!FINNHUB_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.result || []).slice(0, 10); // Limit to 10 results
  } catch (error) {
    console.error(`Failed to search for ${query}:`, error);
    return [];
  }
}
