import { searchStocks, Stock } from "@/lib/stock-research";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { query } = await request.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return Response.json({ error: "Query required" }, { status: 400 });
    }

    // Search for stocks using Claude web search
    const stocks = await searchStocks(query.trim());

    // Return paginated results (max 10)
    const results = stocks.slice(0, 10);

    return Response.json({
      stocks: results,
      count: results.length,
      // Ticker/company lookup relies on Finnhub. If the key is absent and we
      // found nothing, flag it so the UI can explain (topic search still works
      // via Claude, so this is a hint, not a hard error).
      notConfigured: results.length === 0 && !process.env.FINNHUB_API_KEY,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Stock search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
