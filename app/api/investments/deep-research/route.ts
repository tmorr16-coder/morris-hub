import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { unstable_cache } from "next/cache";

export interface DeepResearch {
  recommendation: "BUY" | "HOLD" | "SELL";
  conviction: number;
  priceTarget12m: number;
  summary: string;
  bullCase: string[];
  bearCase: string[];
  catalysts: string[];
  risks: string[];
  evidenceBase: number;
}

const client = new Anthropic();

async function fetchDeepResearchRaw(
  ticker: string,
  name: string,
  price: number,
  sector: string
): Promise<DeepResearch> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: "web_search_20250305" as any, name: "web_search", max_uses: 6 }],
    messages: [
      {
        role: "user",
        content: `You are a professional equity research analyst. Analyze ${ticker} (${name}) as an investment opportunity.
Current price: $${price}${sector ? `. Sector: ${sector}` : ""}.

Use web search to find:
1. Most recent earnings results and guidance
2. Current analyst consensus and price targets
3. Key recent news (last 30 days)
4. Business model and competitive position

Then output your structured investment analysis as JSON inside a \`\`\`json block:

\`\`\`json
{
  "recommendation": "BUY",
  "conviction": 72,
  "priceTarget12m": 230,
  "summary": "2-3 sentence investment thesis with specific data points",
  "bullCase": ["specific bull point 1", "specific bull point 2", "specific bull point 3"],
  "bearCase": ["specific bear point 1", "specific bear point 2", "specific bear point 3"],
  "catalysts": ["near-term catalyst 1", "catalyst 2", "catalyst 3"],
  "risks": ["key risk 1", "key risk 2", "key risk 3"],
  "evidenceBase": 35
}
\`\`\`

Be specific and data-driven. Not financial advice.`,
      },
    ],
  });

  const fullText = response.content
    .filter((b) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => (b as any).text as string)
    .join("\n");

  const fencedMatch = fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  const bareMatch = fullText.match(/{[\s\S]*"recommendation"[\s\S]*}/);
  const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

  if (!jsonStr) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(jsonStr);
  return parsed as DeepResearch;
}

const getCachedResearch = unstable_cache(
  fetchDeepResearchRaw,
  ["deep-research"],
  { revalidate: 21600, tags: ["deep-research"] } // 6 hour cache
);

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: { ticker: string; name: string; price: number; sector?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { ticker, name, price, sector = "" } = body;
  if (!ticker || !name || !price) {
    return Response.json({ error: "ticker, name, and price required" }, { status: 400 });
  }

  try {
    const research = await getCachedResearch(ticker.toUpperCase(), name, price, sector);
    return Response.json(research);
  } catch (err) {
    console.error("[deep-research] failed:", err);
    return Response.json({ error: "Research generation failed" }, { status: 500 });
  }
}
