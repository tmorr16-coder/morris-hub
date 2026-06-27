import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { fetchTickerNews } from "@/lib/news";
import { getMarketNews } from "@/lib/finnhub";

function tagSentiment(headline: string): "bullish" | "bearish" | "neutral" {
  const h = headline.toLowerCase();
  const bullish = ["rises", "gains", "beats", "raises", "upgrade", "record high", "soars", "surges", "rally", "boosts", "wins", "grows", "strong", "outperform", "breakout", "profit"];
  const bearish = ["falls", "drops", "misses", "cuts", "downgrade", "warns", "delays", "slumps", "tumbles", "declines", "loss", "weak", "underperform", "concern", "layoff", "probe", "investigation", "fine", "penalty"];
  if (bullish.some((w) => h.includes(w))) return "bullish";
  if (bearish.some((w) => h.includes(w))) return "bearish";
  return "neutral";
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const name = searchParams.get("name") || ticker || "";

  if (ticker && name) {
    const items = await fetchTickerNews(ticker, name);
    const tagged = items.slice(0, 15).map((item) => ({
      id: String(item.headline),
      headline: item.headline,
      source: item.source,
      timeAgo: item.publishedAt ? timeAgo(new Date(item.publishedAt).getTime()) : "recently",
      related: ticker,
      url: item.url,
      sentiment: tagSentiment(item.headline),
    }));
    return Response.json({ news: tagged });
  }

  // General market news via Finnhub
  const items = await getMarketNews();
  const tagged = items.slice(0, 15).map((item) => ({
    id: String(item.id),
    headline: item.headline,
    source: item.source,
    timeAgo: timeAgo(item.datetime * 1000),
    related: item.related,
    url: item.url,
    sentiment: tagSentiment(item.headline),
  }));
  return Response.json({ news: tagged });
}
