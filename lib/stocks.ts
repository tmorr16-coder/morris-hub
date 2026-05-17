// Yahoo Finance via yahoo-finance2 (unofficial). Free, no key.
// Uses `quoteCombine` — the supported replacement for the deprecated `quote()`.
// Typings are out of sync with the runtime so we cast to a minimal local shape.

import yahooFinance from "yahoo-finance2";

interface RawQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  currency?: string;
  marketState?: string;
  regularMarketTime?: number | Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = yahooFinance as any;

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

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];

  const results = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const q = (await yf.quoteCombine(ticker)) as RawQuote | null;
        if (!q) return null;
        const price = q.regularMarketPrice ?? 0;
        const prev = q.regularMarketPreviousClose ?? price;
        const change = price - prev;
        const changePercent = prev > 0 ? (change / prev) * 100 : 0;
        return {
          symbol: q.symbol,
          shortName: q.shortName ?? q.longName ?? q.symbol,
          price,
          previousClose: prev,
          change,
          changePercent,
          currency: q.currency ?? "USD",
          marketState: q.marketState ?? "CLOSED",
          regularMarketTime:
            typeof q.regularMarketTime === "number"
              ? q.regularMarketTime
              : q.regularMarketTime instanceof Date
              ? Math.floor(q.regularMarketTime.getTime() / 1000)
              : 0,
        } as Quote;
      } catch (e) {
        console.error(`[stocks] ${ticker} failed`, e);
        return null;
      }
    })
  );

  return results.filter((r): r is Quote => r !== null);
}
