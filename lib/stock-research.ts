import { Anthropic } from "@anthropic-ai/sdk";

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

  // Check if it's a direct ticker or known company name
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

  // If not found in common tickers, try as-is (might be a ticker symbol)
  if (q.length <= 5 && /^[a-z]+$/.test(q)) {
    try {
      const stock = await fetchStockPrice(q.toUpperCase());
      return stock ? [stock] : [];
    } catch (e) {
      console.error(`Failed to fetch price for ${q}:`, e);
    }
  }

  return [];
}

// Mock stock data for development/demo purposes
const MOCK_STOCK_DATA: Record<string, Omit<Stock, 'changeDirection'> & { change: number }> = {
  LLY: {
    ticker: "LLY",
    name: "Eli Lilly",
    price: 842.50,
    change: 2.3,
    sector: "Healthcare",
    peRatio: 62.5,
    dividend: 0.9,
  },
  NVDA: {
    ticker: "NVDA",
    name: "Nvidia",
    price: 128.50,
    change: 3.2,
    sector: "Technology",
    peRatio: 48.5,
    dividend: 0.1,
  },
  MSFT: {
    ticker: "MSFT",
    name: "Microsoft",
    price: 429.00,
    change: 0.8,
    sector: "Technology",
    peRatio: 35.2,
    dividend: 0.75,
  },
  GOOGL: {
    ticker: "GOOGL",
    name: "Alphabet",
    price: 180.50,
    change: 1.5,
    sector: "Technology",
    peRatio: 28.3,
    dividend: 0.0,
  },
  AMZN: {
    ticker: "AMZN",
    name: "Amazon",
    price: 198.75,
    change: -0.5,
    sector: "Consumer Discretionary",
    peRatio: 65.2,
    dividend: 0.0,
  },
  AAPL: {
    ticker: "AAPL",
    name: "Apple",
    price: 235.20,
    change: 1.2,
    sector: "Technology",
    peRatio: 32.1,
    dividend: 0.65,
  },
  TSLA: {
    ticker: "TSLA",
    name: "Tesla",
    price: 245.20,
    change: -2.1,
    sector: "Automotive",
    peRatio: 85.3,
    dividend: 0.0,
  },
  META: {
    ticker: "META",
    name: "Meta Platforms",
    price: 512.30,
    change: 2.8,
    sector: "Technology",
    peRatio: 24.5,
    dividend: 0.0,
  },
};

export async function fetchStockPrice(ticker: string): Promise<Stock | null> {
  const mockData = MOCK_STOCK_DATA[ticker.toUpperCase()];

  if (!mockData) {
    return null;
  }

  return {
    ...mockData,
    changeDirection: mockData.change > 0 ? "up" : mockData.change < 0 ? "down" : "neutral",
  };
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
