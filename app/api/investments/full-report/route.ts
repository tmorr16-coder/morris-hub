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
    max_tokens: 3000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: "web_search_20250305" as any, name: "web_search", max_uses: 8 }],
    messages: [
      {
        role: "user",
        content: `You are a buy-side equity research analyst writing a full research note on ${ticker}.

Search the web to gather:
1. Latest earnings report and management guidance
2. Analyst price targets and rating changes (last 90 days)
3. Key recent news events (last 30 days)
4. Segment-level revenue breakdown and margins
5. Comparable company multiples
6. Any pending catalysts (regulatory decisions, product launches, earnings dates)

Then write the full research note as a single JSON block. Include the actual URLs of pages you searched. Output ONLY this JSON:

\`\`\`json
{
  "thesis": "3-4 paragraph investment thesis narrative. Be specific about financials, margins, growth rates, and why the stock is interesting or not. First paragraph is the headline thesis. Second covers business quality. Third covers valuation. Fourth covers key risk/reward.",
  "businessOverview": "2-3 paragraph overview of the business model, key revenue segments with approximate size/mix, competitive moat, and what drives the economics of this business.",
  "valuation": {
    "narrative": "2 paragraph valuation analysis referencing specific multiples, why they are justified or stretched vs history and peers, and what the market is pricing in.",
    "currentMultiple": "e.g. 41x NTM P/E",
    "historicalRange": "e.g. 28–58x over 5 years",
    "scenarioBase": "Base: $X target — [1-2 sentence assumption set]",
    "scenarioBull": "Bull: $X target — [1-2 sentence assumption set]",
    "scenarioBear": "Bear: $X target — [1-2 sentence assumption set]"
  },
  "compTable": [
    { "name": "Company Name", "ticker": "TICK", "metric": "38x fwd P/E", "note": "1-line positioning vs subject" }
  ],
  "catalysts": [
    { "catalyst": "Specific catalyst name", "timeline": "Q3 2025", "impact": "1-line expected impact on thesis" }
  ],
  "risks": [
    { "risk": "Specific risk title", "severity": "high", "detail": "1-2 sentence detail on how this risk materializes and what it means for the investment" }
  ],
  "sources": [
    { "title": "Page title or article headline", "url": "https://actual-url.com", "type": "earnings" }
  ]
}
\`\`\`

compTable: 4-5 peers. catalysts: 3-4 items. risks: 3-4 items with severity high/medium/low. sources: list every URL you actually read, 5-15 items. Not financial advice.`,
      },
    ],
  });

  const fullText = response.content
    .filter((b) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => (b as any).text as string)
    .join("\n");

  const fencedMatch = fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  const bareMatch = fullText.match(/{[\s\S]*"thesis"[\s\S]*}/);
  const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

  if (!jsonStr) throw new Error("No JSON in Claude full-report response");

  const parsed = JSON.parse(jsonStr);
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
