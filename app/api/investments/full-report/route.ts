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

// Tool schema — Claude must call this to submit the report.
// Structured tool_use input bypasses all JSON-in-text parsing issues.
const WRITE_REPORT_TOOL: Anthropic.Tool = {
  name: "write_report",
  description: "Submit the completed equity research report as structured data.",
  input_schema: {
    type: "object" as const,
    properties: {
      thesis: { type: "string", description: "2-paragraph investment thesis. Use \\n between paragraphs." },
      businessOverview: { type: "string", description: "1-2 paragraph business model: key segments, moat, growth driver." },
      valuation: {
        type: "object",
        properties: {
          narrative: { type: "string", description: "1 paragraph on current multiple vs history and peers." },
          currentMultiple: { type: "string", description: "e.g. 41x NTM P/E" },
          historicalRange: { type: "string", description: "e.g. 28–58x over 5 years" },
          scenarioBase: { type: "string", description: "e.g. Base: $230 — moderate growth" },
          scenarioBull: { type: "string", description: "e.g. Bull: $275 — upside case" },
          scenarioBear: { type: "string", description: "e.g. Bear: $160 — downside case" },
        },
        required: ["narrative", "currentMultiple", "historicalRange", "scenarioBase", "scenarioBull", "scenarioBear"],
      },
      compTable: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            ticker: { type: "string" },
            metric: { type: "string", description: "e.g. 38x fwd P/E" },
            note: { type: "string", description: "One-line positioning vs subject company" },
          },
          required: ["name", "ticker", "metric", "note"],
        },
      },
      catalysts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            catalyst: { type: "string" },
            timeline: { type: "string", description: "e.g. Q3 2025" },
            impact: { type: "string", description: "One-line expected impact" },
          },
          required: ["catalyst", "timeline", "impact"],
        },
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            risk: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            detail: { type: "string", description: "One sentence on how this risk materializes" },
          },
          required: ["risk", "severity", "detail"],
        },
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            type: { type: "string", enum: ["earnings", "news", "analyst", "filing", "other"] },
          },
          required: ["title", "url", "type"],
        },
      },
    },
    required: ["thesis", "businessOverview", "valuation", "compTable", "catalysts", "risks", "sources"],
  },
};

async function fetchFullReport(ticker: string): Promise<FullReport> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    tools: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: "web_search_20250305" as any, name: "web_search", max_uses: 5 },
      WRITE_REPORT_TOOL,
    ],
    messages: [
      {
        role: "user",
        content: `You are an equity research analyst. Research ${ticker} using web search (latest earnings, analyst targets, recent news, comparable company multiples), then call write_report with your structured findings. Include every URL you read as a source.`,
      },
    ],
  });

  // Find the write_report tool_use block — this is guaranteed structured data
  const reportBlock = response.content.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && (b as any).name === "write_report"
  );

  if (!reportBlock) {
    const text = response.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("\n");
    console.error(`[full-report] ${ticker} write_report not called. stop_reason: ${response.stop_reason}. Text preview: ${text.slice(0, 300)}`);
    throw new Error("Research incomplete — try again");
  }

  const input = reportBlock.input as Omit<FullReport, "ticker" | "generatedAt">;
  return { ...input, ticker, generatedAt: new Date().toISOString() };
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
    console.error("[full-report] failed:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
