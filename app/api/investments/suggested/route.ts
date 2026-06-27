import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { unstable_cache } from "next/cache";

interface SuggestedStock {
  ticker: string;
  badge: string;
  rationale: string;
}

const client = new Anthropic();

async function fetchSuggestionsRaw(tickers: string[]): Promise<SuggestedStock[]> {
  if (!tickers.length) return [];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `A user watches these stocks: ${tickers.join(", ")}.

Suggest 3-4 complementary stocks they are NOT watching but should research, to fill gaps in diversification or capture related opportunities.

For each suggestion, choose a badge from: "New idea", "Watchlist gap", "Earnings soon", or "Up X% today" (use a realistic number for the Up badge only if the stock is having a strong day).

Return JSON inside a \`\`\`json block:
\`\`\`json
{
  "suggestions": [
    {
      "ticker": "AVGO",
      "badge": "Earnings soon",
      "rationale": "Custom-silicon demand and VMware accretion compounding into FY26."
    }
  ]
}
\`\`\`

Keep rationale under 80 characters. Suggest real, liquid US-listed stocks only.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => (b as any).text as string)
    .join("\n");

  const fencedMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  const bareMatch = text.match(/{[\s\S]*"suggestions"[\s\S]*}/);
  const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];
  if (!jsonStr) return [];

  const parsed = JSON.parse(jsonStr);
  return (parsed.suggestions ?? []) as SuggestedStock[];
}

const getCachedSuggestions = unstable_cache(
  fetchSuggestionsRaw,
  ["suggested-stocks"],
  { revalidate: 3600, tags: ["suggested-stocks"] }
);

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("tickers") || "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!tickers.length) return Response.json({ suggestions: [] });

  try {
    const suggestions = await getCachedSuggestions(tickers);
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
