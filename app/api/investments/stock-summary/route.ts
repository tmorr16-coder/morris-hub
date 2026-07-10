import { fetchStockPrice, generateStockSummary } from "@/lib/stock-research";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { unstable_cache } from "next/cache";

// AI summary generation can take 5-15s (Claude + web search). It's expensive,
// so allow up to 30s and let callers that only need a live quote skip it
// entirely via ?quote=1 (used by the watchlist, which never shows the summary).
export const maxDuration = 30;

// Cache stock summaries for 24 hours.
// `quoteOnly` is part of the cache args, so the fast quote-only variant and the
// full summary variant are cached under separate keys and never collide.
const getCachedStockSummary = unstable_cache(
  async (ticker: string, quoteOnly: boolean) => {
    const stock = await fetchStockPrice(ticker.toUpperCase());
    if (!stock) {
      throw new Error(`Stock ${ticker} not found`);
    }

    if (quoteOnly) {
      return { stock, summary: "" };
    }

    // Summary generation must never sink the whole request — if it fails,
    // still return the live quote so price/name always render.
    let summary = "";
    try {
      summary = await generateStockSummary(ticker.toUpperCase(), stock);
    } catch (err) {
      console.error(`[stock-summary] summary generation failed for ${ticker}:`, err);
      summary = "Summary temporarily unavailable.";
    }
    return { stock, summary };
  },
  ["stock-summary"],
  { revalidate: 86400, tags: ["stock-summary"] } // 24 hour cache
);

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker");
    const quoteOnly = searchParams.get("quote") === "1";

    if (!ticker || typeof ticker !== "string") {
      return Response.json({ error: "Ticker required" }, { status: 400 });
    }

    // Distinguish "stock data not configured" (missing key) from a real error
    // so the UI can show a clear state instead of a silent blank.
    if (!process.env.FINNHUB_API_KEY) {
      return Response.json(
        { error: "Stock data not configured", notConfigured: true },
        { status: 503 }
      );
    }

    const { stock, summary } = await getCachedStockSummary(ticker, quoteOnly);

    return Response.json({
      ticker: stock.ticker,
      name: stock.name,
      price: stock.price,
      change: stock.change,
      changeDirection: stock.changeDirection,
      sector: stock.sector,
      peRatio: stock.peRatio,
      dividend: stock.dividend,
      summary,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Stock summary error:", error);
    const message = error instanceof Error ? error.message : "Summary failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
