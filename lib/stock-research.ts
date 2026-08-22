import { Anthropic } from "@anthropic-ai/sdk";
import { getStockQuote, getCompanyProfile, searchSymbol } from "./finnhub";
import { MODEL_FAST } from "@/lib/models";

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
  reason?: string;   // set by topic search — one-line rationale from Claude
}

// Common ticker mappings for quick lookup
const COMMON_TICKERS: Record<string, string> = {
  // Companies
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
  // Indices → ETF proxies
  "s&p": "SPY",
  "s&p 500": "SPY",
  "sp500": "SPY",
  "spx": "SPY",
  "spy": "SPY",
  "s&p500": "SPY",
  "standard and poor": "SPY",
  "nasdaq": "QQQ",
  "nasdaq 100": "QQQ",
  "qqq": "QQQ",
  "dow": "DIA",
  "dow jones": "DIA",
  "djia": "DIA",
  "dia": "DIA",
  // Broad market ETFs
  "vti": "VTI",
  "total market": "VTI",
  "iwm": "IWM",
  "russell 2000": "IWM",
  "small cap": "IWM",
};

// Is this a topic query (vs a ticker/company name)?
// Topics have spaces or are long natural-language phrases.
function looksLikeTopic(q: string): boolean {
  const trimmed = q.trim();
  if (trimmed.includes(" ")) return true;            // multi-word = topic
  if (trimmed.length > 6 && !/^[a-z]+$/.test(trimmed)) return false; // camelCase etc
  return trimmed.length > 8;                          // very long single word
}

export async function searchStocks(query: string): Promise<Stock[]> {
  const q = query.toLowerCase().trim();

  // Known ticker/name shortcut
  const ticker = COMMON_TICKERS[q];
  if (ticker) {
    const stock = await fetchStockPrice(ticker).catch(() => null);
    return stock ? [stock] : [];
  }

  // Try Finnhub symbol search (fast, handles tickers + company names)
  let finnhubStocks: Stock[] = [];
  try {
    const results = await searchSymbol(q);
    for (const result of results.slice(0, 5)) {
      if (!result.displaySymbol.includes(".")) {
        const stock = await fetchStockPrice(result.displaySymbol).catch(() => null);
        if (stock) finnhubStocks.push(stock);
      }
    }
  } catch (e) {
    console.error(`Finnhub search failed for "${q}":`, e);
  }

  if (finnhubStocks.length > 0) return finnhubStocks;

  // Fallback: topic search via Claude when Finnhub finds nothing
  if (looksLikeTopic(q)) {
    return searchStocksByTopic(query.trim());
  }

  return [];
}

// ── Topic search via Claude ───────────────────────────────────────────────────

async function searchStocksByTopic(topic: string): Promise<Stock[]> {
  const client = new Anthropic();

  let tickerSuggestions: Array<{ ticker: string; reason: string }> = [];
  try {
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 600,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305" as any, name: "web_search", max_uses: 3 }],
      messages: [{
        role: "user",
        content: `List 6 specific US-listed stocks or ETFs most relevant to: "${topic}"

Use web search if needed for current, accurate results. Output ONLY this JSON:

\`\`\`json
{"stocks":[{"ticker":"NVDA","reason":"One sentence why this fits the topic"}]}
\`\`\`

US tickers only. Mix large-caps and relevant ETFs where appropriate.`,
      }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("\n")
      .replace(/<\/?cite[^>]*>/gi, "");

    const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const bare = text.match(/\{[\s\S]*"stocks"[\s\S]*\}/);
    const jsonStr = fenced?.[1] ?? bare?.[0];
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      tickerSuggestions = (parsed.stocks ?? []).slice(0, 8);
    }
  } catch (e) {
    console.error(`Topic search failed for "${topic}":`, e);
    return [];
  }

  // Fetch live prices for each suggested ticker
  const stocks = await Promise.all(
    tickerSuggestions.map(async ({ ticker, reason }) => {
      const stock = await fetchStockPrice(ticker.toUpperCase()).catch(() => null);
      if (!stock) return null;
      return { ...stock, reason };
    })
  );

  return stocks.filter(Boolean) as Stock[];
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
    model: MODEL_FAST,
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
