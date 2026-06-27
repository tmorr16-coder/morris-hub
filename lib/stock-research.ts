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

export async function searchStocks(query: string): Promise<Stock[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    tools: [
      {
        name: "web_search",
        description: "Search the web for information",
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
        content: `Find 5 US stock tickers matching or similar to "${query}". Return a JSON array with exact ticker symbols and company names. Format: [{"ticker": "NVDA", "name": "Nvidia Corporation"}, ...]. Only return JSON, no other text.`,
      },
    ],
  });

  // Extract text from response
  let searchResults = "";
  for (const block of response.content) {
    if (block.type === "text") {
      searchResults += block.text;
    }
  }

  // Parse JSON from response
  try {
    const matches = searchResults.match(/\[[\s\S]*\]/);
    if (!matches) return [];

    const tickers = JSON.parse(matches[0]);

    // Now fetch current prices for each ticker
    const stocks: Stock[] = [];
    for (const ticker of tickers) {
      try {
        const stock = await fetchStockPrice(ticker.ticker);
        if (stock) {
          stocks.push({
            ...stock,
            name: ticker.name || stock.name,
          });
        }
      } catch (e) {
        // Skip if price fetch fails
        console.error(`Failed to fetch price for ${ticker.ticker}:`, e);
      }
    }

    return stocks;
  } catch (e) {
    console.error("Failed to parse stock search results:", e);
    return [];
  }
}

export async function fetchStockPrice(ticker: string): Promise<Stock | null> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    tools: [
      {
        name: "web_search",
        description: "Search the web for current stock information",
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
        content: `Get current stock price for ${ticker} ticker. Return ONLY a JSON object with: ticker (string), name (string), price (number), change (number as percent), sector (string or null), peRatio (number or null), dividend (number as percent or null). Example: {"ticker":"NVDA","name":"Nvidia","price":128.50,"change":3.2,"sector":"Technology","peRatio":48.5,"dividend":0.1}. Return only JSON, no other text.`,
      },
    ],
  });

  let priceData = "";
  for (const block of response.content) {
    if (block.type === "text") {
      priceData += block.text;
    }
  }

  try {
    const jsonMatch = priceData.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ticker: parsed.ticker,
      name: parsed.name,
      price: parsed.price,
      change: parsed.change,
      changeDirection: parsed.change > 0 ? "up" : parsed.change < 0 ? "down" : "neutral",
      sector: parsed.sector,
      peRatio: parsed.peRatio,
      dividend: parsed.dividend,
    };
  } catch (e) {
    console.error(`Failed to parse stock price for ${ticker}:`, e);
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
