import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export const maxDuration = 60;

export interface ReportSource {
  title: string;
  url: string;
  type: "earnings" | "news" | "analyst" | "filing" | "other";
}

export interface ReportComp {
  name: string;
  ticker: string;
  metric: string;
  note: string;
}

export interface ReportRisk {
  risk: string;
  severity: "high" | "medium" | "low";
  detail: string;
}

export interface ReportCatalyst {
  catalyst: string;
  timeline: string;
  impact: string;
}

export interface FullReport {
  ticker: string;
  thesis: string;
  businessOverview: string;
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

// Claude sometimes writes literal newlines inside JSON string values,
// which breaks JSON.parse. Walk char-by-char and escape them.
function repairJsonStrings(s: string): string {
  let inString = false;
  let escaped = false;
  let result = "";
  for (const ch of s) {
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === "\\" && inString) { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && ch === "\n") { result += "\\n"; continue; }
    if (inString && ch === "\r") continue;
    result += ch;
  }
  return result;
}

async function fetchFullReport(ticker: string): Promise<FullReport> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: "web_search_20250305" as any, name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content: `You are an equity research analyst. Search the web for ${ticker}: latest earnings/guidance, analyst price targets, recent news, comparable company multiples.

Output ONLY valid JSON inside a \`\`\`json block. Use \\n for line breaks inside strings — never raw newlines. All string values must be on a single line.

\`\`\`json
{
  "thesis": "Paragraph 1 of thesis. \\n\\n Paragraph 2 of thesis.",
  "businessOverview": "Business model summary on one line.",
  "valuation": {
    "narrative": "Valuation paragraph on one line.",
    "currentMultiple": "41x NTM P/E",
    "historicalRange": "28–58x over 5 years",
    "scenarioBase": "Base: $230 — moderate growth assumption",
    "scenarioBull": "Bull: $275 — acceleration in X",
    "scenarioBear": "Bear: $160 — margin compression from Y"
  },
  "compTable": [
    { "name": "Company Name", "ticker": "TICK", "metric": "38x fwd P/E", "note": "positioning vs subject" }
  ],
  "catalysts": [
    { "catalyst": "Catalyst name", "timeline": "Q3 2025", "impact": "one-line expected impact" }
  ],
  "risks": [
    { "risk": "Risk title", "severity": "high", "detail": "one sentence on materialization" }
  ],
  "sources": [
    { "title": "Page title", "url": "https://actual-url.com", "type": "earnings" }
  ]
}
\`\`\`

Rules: 3-4 comps, 3 catalysts, 3 risks, all sources you actually read. severity must be high/medium/low. type must be earnings/news/analyst/filing/other.`,
      },
    ],
  });

  const fullText = response.content
    .filter((b) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => (b as any).text as string)
    .join("\n");

  console.log(`[full-report] ${ticker} text length: ${fullText.length}`);

  // Extract JSON — greedy match inside code fence
  const fenced = fullText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  const bare = fullText.match(/\{[\s\S]*"thesis"[\s\S]*\}/);
  const raw = fenced?.[1] ?? bare?.[0];

  if (!raw) {
    console.error(`[full-report] ${ticker} no JSON block found. Text: ${fullText.slice(0, 500)}`);
    throw new Error("Claude did not return a JSON block");
  }

  const repaired = repairJsonStrings(raw);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(repaired);
  } catch (e) {
    console.error(`[full-report] ${ticker} parse error:`, (e as Error).message);
    console.error(`[full-report] raw snippet:`, raw.slice(0, 300));
    throw new Error("Could not parse report JSON");
  }

  return { ...parsed, ticker, generatedAt: new Date().toISOString() } as FullReport;
}

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
    const report = await fetchFullReport(ticker.toUpperCase());
    return Response.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report generation failed";
    console.error("[full-report] POST failed:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
