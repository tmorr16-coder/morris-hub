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

// Cache keyed only on ticker — price fluctuations shouldn't bust the cache
async function fetchDeepResearchRaw(ticker: string): Promise<DeepResearch> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are a professional equity research analyst with deep knowledge of public markets. Analyze ${ticker} as an investment.

Based on your knowledge of this company's business model, financials, competitive position, and market dynamics, provide a structured investment analysis. Output ONLY the JSON below — no other text:

\`\`\`json
{
  "recommendation": "BUY",
  "conviction": 72,
  "priceTarget12m": 230,
  "summary": "2-3 sentence investment thesis with specific business metrics or competitive dynamics",
  "bullCase": ["specific bull point with data", "bull point 2", "bull point 3"],
  "bearCase": ["specific bear point with data", "bear point 2", "bear point 3"],
  "catalysts": ["near-term catalyst 1", "catalyst 2", "catalyst 3"],
  "risks": ["key risk 1 with specifics", "risk 2", "risk 3"],
  "evidenceBase": 28
}
\`\`\`

Use BUY / HOLD / SELL for recommendation. conviction is 0-100. priceTarget12m is a dollar number. Be specific — cite product lines, margins, competitors, regulatory factors, etc. Not financial advice.`,
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
  { revalidate: 21600, tags: ["deep-research"] } // 6 hour cache per ticker
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
