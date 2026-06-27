import { Anthropic } from "@anthropic-ai/sdk";
import { getStockQuote, getCompanyProfile, searchSymbol } from "./finnhub";

export interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number; // percent
  changeDirection: "up" | "down" | "neutral";
  sector?: string;
  marketCap?: string;
  peRatio?: number;
  dividend?: number; // percent
}

// Common ticker mappings for quick lookup
const COMMON_TICKERS: Record<string, string> = {
  lly: "LLY",
  lily: "LLY",
  "eli lilly": "LLY",
  nvda: "NVDA",
  nvidia: "NVDA",
  msft: "MSFT",
  microsoft: "MSFT",
  googl: "GOOGL",
  google: "GOOGL",
  amzn: "AMZN",
  amazon: "AMZN",
  aapl: "AAPL",
  apple: "AAPL",
  tsla: "TSLA",
  tesla: "TSLA",
  meta: "META",
  facebook: "META",
};

export async function searchStocks(query: string): Promise<Stock[]> {
  const q = query.toLowerCase().trim();

  // Check if it's a known company name first
  const ticker = COMMON_TICKERS[q];
  if (ticker) {
    try {
      const stock = await fetchStockPrice(ticker);
      return stock ? [stock] : [];
    } catch (e) {
      console.error(`Failed to fetch price for ${ticker}:`, e);
      return [];
    }
  }

  // Try Finnhub search API for unknown queries
  try {
    const results = await searchSymbol(q);
    const stocks: Stock[] = [];

    for (const result of results) {
      // Only include US stocks
      if (!result.displaySymbol.includes(".")) {
        const stock = await fetchStockPrice(result.displaySymbol);
        if (stock) {
          stocks.push(stock);
        }
      }
    }

    return stocks;
  } catch (e) {
    console.error(`Failed to search stocks for ${q}:`, e);
    return [];
  }
}

export async function fetchStockPrice(ticker: string): Promise<Stock | null> {
  try {
    const [quote, profile] = await Promise.all([
      getStockQuote(ticker),
      getCompanyProfile(ticker),
    ]);

    if (!quote || !profile) {
      return null;
    }

    // Calculate percent change from current vs previous close
    const change = quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : 0;

    return {
      ticker: ticker.toUpperCase(),
      name: profile.name || ticker,
      price: quote.c,
      change: parseFloat(change.toFixed(2)),
      changeDirection: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      sector: profile.finnhubIndustry || undefined,
      marketCap: profile.marketCapitalization
        ? `$${(profile.marketCapitalization / 1e9).toFixed(2)}B`
        : undefined,
      peRatio: undefined, // Finnhub free tier doesn't include PE ratio
      dividend: undefined, // Would need dividend API call
    };
  } catch (e) {
    console.error(`Failed to fetch stock price for ${ticker}:`, e);
    return null;
  }
}

export async function generateStockSummary(
  ticker: string,
  stockData: Stock
): Promise<string> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    tools: [
      {
        name: "web_search",
        description: "Search the web for stock information",
        input_schema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
          },
          required: ["query"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Write a 200-300 word investment analysis summary for ${ticker} (${stockData.name}). Current price: $${stockData.price}, PE: ${stockData.peRatio}, Sector: ${stockData.sector}.

Include: business model, competitive position, key growth drivers, risks, valuation assessment, and recent news context. Be balanced - highlight both strengths and concerns. Avoid tipping into financial advice. Write in clear, accessible language for retail investors.`,
      },
    ],
  });

  let summary = "";
  for (const block of response.content) {
    if (block.type === "text") {
      summary += block.text;
    }
  }

  return summary || "Summary not available";
}
