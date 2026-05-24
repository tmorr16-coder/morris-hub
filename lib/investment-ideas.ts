import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "./supabase/server";
import type { InvestmentIdea, InvestmentIdeaInput } from "./investment-ideas-constants";
import { CATEGORY_LABELS } from "./investment-ideas-constants";

// Re-export constants for convenience
export {
  CATEGORY_LABELS,
  RISK_COLORS,
  STATUS_LABELS,
  TIME_HORIZON_LABELS,
  type InvestmentIdea,
  type InvestmentIdeaInput,
} from "./investment-ideas-constants";

interface GeneratedIdea {
  category: string;
  title: string;
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  timeHorizon: "short" | "medium" | "long";
  capitalRequired?: string;
  expectedReturns?: string;
  relatedAssets?: string[];
  actionItems?: string[];
}

// ── AI Idea Generation ───────────────────────────────────────────────

async function generateIdeasRaw(
  categories: string[],
  userContext?: { currentStocks?: string[]; riskTolerance?: string }
): Promise<InvestmentIdea[]> {
  const client = new Anthropic();

  const categoryList = categories
    .map((c) => CATEGORY_LABELS[c] || c)
    .join(", ");

  const contextStr = userContext
    ? `\nUser context: Current portfolio includes [${userContext.currentStocks?.join(", ") || "none"}]. Risk tolerance: ${userContext.riskTolerance || "moderate"}.`
    : "";

  const prompt = `You are an investment research assistant. Generate 2-3 interesting and realistic investment ideas for each of these categories: ${categoryList}.${contextStr}

For EACH idea, provide a JSON object with these fields (required: category, title, rationale, riskLevel, timeHorizon; optional: capitalRequired, expectedReturns, relatedAssets, actionItems):

{
  "ideas": [
    {
      "category": "Stocks",
      "title": "Idea title",
      "rationale": "Why this is a good investment...",
      "riskLevel": "low|medium|high",
      "timeHorizon": "short|medium|long",
      "capitalRequired": "$X-$Y" (optional),
      "expectedReturns": "X-Y% annually" (optional),
      "relatedAssets": ["TICKER1", "TICKER2"] (optional),
      "actionItems": ["Research step 1", "Research step 2"] (optional)
    }
  ]
}

Generate ideas that are specific, actionable, and realistic. Focus on diversified opportunities across different sub-sectors within each category. Return ONLY valid JSON.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ],
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract text from response
  let fullText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      fullText += block.text + "\n";
    }
  }

  // Parse JSON from response
  const jsonMatch =
    fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) ||
    fullText.match(/{[\s\S]*"ideas"[\s\S]*}/);

  if (!jsonMatch) {
    console.error("Could not parse investment ideas response:", fullText);
    return [];
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const ideas = parsed.ideas || [];

  // Transform to InvestmentIdea format
  return ideas.map((idea: GeneratedIdea) => ({
    id: crypto.randomUUID(),
    userId: "", // Will be set by server action
    category: (idea.category?.toLowerCase() || "other") as any,
    title: idea.title,
    rationale: idea.rationale || null,
    riskLevel: (idea.riskLevel || null) as any,
    timeHorizon: (idea.timeHorizon || null) as any,
    capitalRequired: idea.capitalRequired || null,
    expectedReturns: idea.expectedReturns || null,
    relatedAssets: idea.relatedAssets || null,
    actionItems: idea.actionItems || null,
    isAiGenerated: true,
    source: "claude",
    rating: null,
    status: "new",
    isFavorite: false,
    userNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// Wrap with cache: 24-hour TTL for daily refresh
const cachedGenerateIdeas = unstable_cache(
  generateIdeasRaw,
  ["investment-ideas"],
  {
    tags: ["investment-ideas"],
    revalidate: 86400, // 24 hours
  }
);

export async function generateInvestmentIdeas(
  categories: string[],
  userContext?: { currentStocks?: string[]; riskTolerance?: string }
): Promise<InvestmentIdea[]> {
  const sorted = [...categories].sort(); // Normalize key order for cache hits
  return cachedGenerateIdeas(sorted, userContext);
}

// ── Database Access ─────────────────────────────────────────────────

export async function getUserInvestmentIdeas(userId: string): Promise<InvestmentIdea[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data, error } = await service
    .schema("hub")
    .from("investment_ideas")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching investment ideas:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    rationale: row.rationale,
    riskLevel: row.risk_level,
    timeHorizon: row.time_horizon,
    capitalRequired: row.capital_required,
    expectedReturns: row.expected_returns,
    relatedAssets: row.related_assets,
    actionItems: row.action_items,
    isAiGenerated: row.is_ai_generated,
    source: row.source,
    rating: row.rating,
    status: row.status,
    isFavorite: row.is_favorite,
    userNotes: row.user_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
