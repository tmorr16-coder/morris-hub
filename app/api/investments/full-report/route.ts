import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { unstable_cache } from "next/cache";

export const maxDuration = 60;

export interface ReportSource {
  title: string;
  url: string;
  type: "earnings" | "news" | "analyst" | "filing" | "other";
}

export interface ReportComp {
  name: string;
  ticker: string;
  metric: string; // e.g. "41x fwd P/E"
  note: string;
}

export interface ReportRisk {
  risk: string;
  severity: "high" | "medium" | "low";
  detail: string;
}

export interface ReportCatalyst {
  catalyst: string;
  timeline: string; // e.g. "Q3 2025", "12-18 months"
  impact: string;
}

export interface FullReport {
  ticker: string;
  thesis: string;           // 3-4 paragraph deep thesis narrative
  businessOverview: string; // key segments, moat, competitive position
  valuation: {
    narrative: string;
    currentMultiple: string;
    historicalRange: string;
    scenarioBase: string;
    scenarioBull: string;
    scenarioBear: string;
  };
  compTable: ReportComp[];
  catalysts: ReportCatalyst[];
  risks: ReportRisk[];
  sources: ReportSource[];
  generatedAt: string;
}

const client = new Anthropic();

async function fetchFullReportRaw(ticker: string): Promise<FullReport> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: "web_search_20250305" as any, name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content: `You are an equity research analyst. Search the web for ${ticker} and find: latest earnings/guidance, analyst price targets, recent news, and 3-4 comparable companies.

Output ONLY this JSON (no other text):

\`\`\`json
{
  "thesis": "2 paragraph thesis. P1: headline investment case with specific financials. P2: key risk/reward and what makes this interesting now.",
  "businessOverview": "1-2 paragraph business model overview: key revenue segments with rough size, competitive moat, main growth driver.",
  "valuation": {
    "narrative": "1 paragraph: current multiple, whether it is cheap or expensive vs history and peers, and what the market is pricing in.",
    "currentMultiple": "e.g. 41x NTM P/E",
    "historicalRange": "e.g. 28–58x over 5 years",
    "scenarioBase": "Base: $X — brief assumption",
    "scenarioBull": "Bull: $X — brief assumption",
    "scenarioBear": "Bear: $X — brief assumption"
  },
  "compTable": [
    { "name": "Company Name", "ticker": "TICK", "metric": "38x fwd P/E", "note": "one-line vs subject" }
  ],
  "catalysts": [
    { "catalyst": "Catalyst name", "timeline": "Q3 2025", "impact": "one-line impact" }
  ],
  "risks": [
    { "risk": "Risk title", "severity": "high", "detail": "one sentence on how it materializes" }
  ],
  "sources": [
    { "title": "Article or page title", "url": "https://real-url.com", "type": "earnings" }
  ]
}
\`\`\`

compTable: 3-4 peers. catalysts: 3 items. risks: 3 items (severity: high/medium/low). sources: every URL you actually read. Not financial advice.`,
      },
    ],
  });

  const fullText = response.content
    .filter((b) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => (b as any).text as string)
    .join("\n");

  console.log(`[full-report] ${ticker} response length: ${fullText.length} chars`);

  // Greedy match inside code fence captures the full nested JSON object
  const fencedMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  // Fallback: find the outermost { } that contains "thesis"
  const bareMatch = fullText.match(/\{[\s\S]*"thesis"[\s\S]*\}/);
  const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

  if (!jsonStr) {
    console.error(`[full-report] ${ticker} no JSON found. Preview:`, fullText.slice(0, 400));
    throw new Error("No JSON in Claude response");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[full-report] ${ticker} JSON parse failed:`, e, jsonStr.slice(0, 200));
    throw new Error("Malformed JSON in Claude response");
  }

  return { ...parsed, ticker, generatedAt: new Date().toISOString() } as FullReport;
}

const getCachedFullReport = unstable_cache(
  fetchFullReportRaw,
  ["full-report"],
  { revalidate: 7200, tags: ["full-report"] } // 2 hour cache
);

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: { ticker: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { ticker } = body;
  if (!ticker) return Response.json({ error: "ticker required" }, { status: 400 });

  try {
    const report = await getCachedFullReport(ticker.toUpperCase());
    return Response.json(report);
  } catch (err) {
    console.error("[full-report] failed:", err);
    return Response.json({ error: "Report generation failed" }, { status: 500 });
  }
}
