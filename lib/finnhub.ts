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
