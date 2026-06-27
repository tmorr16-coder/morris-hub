import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { unstable_cache } from "next/cache";

export const maxDuration = 60;

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

// Cache keyed only on ticker — 1 hour TTL so web-search data stays fresh
async function fetchDeepResearchRaw(ticker: string): Promise<DeepResearch> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: "web_search_20250305" as any, name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content: `You are a professional equity research analyst. Use web search to research ${ticker} right now and find:
1. Most recent earnings results and any guidance updates
2. Current analyst consensus rating and price targets
3. Key news from the last 2 weeks
4. Any recent catalysts or risk events

Then output ONLY a JSON block with your analysis — no other text:

\`\`\`json
{
  "recommendation": "BUY",
  "conviction": 72,
  "priceTarget12m": 230,
  "summary": "2-3 sentence thesis referencing specific recent data you found",
  "bullCase": ["data-driven bull point 1", "bull point 2", "bull point 3"],
  "bearCase": ["data-driven bear point 1", "bear point 2", "bear point 3"],
  "catalysts": ["near-term catalyst from recent news", "catalyst 2", "catalyst 3"],
  "risks": ["current risk with specifics", "risk 2", "risk 3"],
  "evidenceBase": 35
}
\`\`\`

Use BUY / HOLD / SELL. conviction 0-100. priceTarget12m in dollars. Not financial advice.`,
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

  // Strip <cite index="N"> tags injected by web_search tool before parsing
  const clean = (s: string) => s.replace(/<\/?cite[^>]*>/gi, "").trim();
  const cleaned = jsonStr.replace(/<\/?cite[^>]*>/gi, "");
  const parsed = JSON.parse(cleaned);

  // Clean any remaining tags in string fields (belt-and-suspenders)
  return {
    recommendation: parsed.recommendation,
    conviction: parsed.conviction,
    priceTarget12m: parsed.priceTarget12m,
    summary: clean(parsed.summary ?? ""),
    bullCase: (parsed.bullCase ?? []).map(clean),
    bearCase: (parsed.bearCase ?? []).map(clean),
    catalysts: (parsed.catalysts ?? []).map(clean),
    risks: (parsed.risks ?? []).map(clean),
    evidenceBase: parsed.evidenceBase,
  } as DeepResearch;
}

const getCachedResearch = unstable_cache(
  fetchDeepResearchRaw,
  ["deep-research"],
  { revalidate: 3600, tags: ["deep-research"] } // 1 hour cache — web search data stays reasonably fresh
);

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: { ticker: string; name?: string; price?: number; sector?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { ticker } = body;
  if (!ticker) return Response.json({ error: "ticker required" }, { status: 400 });

  try {
    const research = await getCachedResearch(ticker.toUpperCase());
    return Response.json(research);
  } catch (err) {
    console.error("[deep-research] failed:", err);
    return Response.json({ error: "Research generation failed" }, { status: 500 });
  }
}
