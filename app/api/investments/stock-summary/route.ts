import { fetchStockPrice, generateStockSummary } from "@/lib/stock-research";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { unstable_cache } from "next/cache";

// Cache stock summaries for 24 hours
const getCachedStockSummary = unstable_cache(
  async (ticker: string) => {
    const stock = await fetchStockPrice(ticker.toUpperCase());
    if (!stock) {
      throw new Error(`Stock ${ticker} not found`);
    }

    const summary = await generateStockSummary(ticker.toUpperCase(), stock);
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

    if (!ticker || typeof ticker !== "string") {
      return Response.json({ error: "Ticker required" }, { status: 400 });
    }

    const { stock, summary } = await getCachedStockSummary(ticker);

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
