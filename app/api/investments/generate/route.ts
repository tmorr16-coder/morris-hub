import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateInvestmentIdeas } from "@/lib/investment-ideas";

// Web-search-grounded generation fires several searches — give it room so it
// doesn't hit the default serverless timeout and surface "Failed to generate".
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get categories from request body
    const { categories } = await req.json();
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: "Invalid categories" }, { status: 400 });
    }

    // Generate AI ideas
    const ideas = await generateInvestmentIdeas(categories);

    if (ideas.length === 0) {
      return NextResponse.json({ error: "No ideas generated" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    // Delete existing AI-generated ideas for this user, then insert fresh ones
    await service
      .schema("hub")
      .from("investment_ideas")
      .delete()
      .eq("user_id", user.id)
      .eq("is_ai_generated", true);

    const rows = ideas.map((idea) => ({
      user_id: user.id,
      category: idea.category,
      title: idea.title,
      rationale: idea.rationale ?? null,
      risk_level: idea.riskLevel ?? null,
      time_horizon: idea.timeHorizon ?? null,
      capital_required: idea.capitalRequired ?? null,
      expected_returns: idea.expectedReturns ?? null,
      related_assets: idea.relatedAssets ?? null,
      action_items: idea.actionItems ?? null,
      is_ai_generated: true,
      source: "claude",
      status: "new",
      is_favorite: false,
    }));

    const { data: saved, error: insertError } = await service
      .schema("hub")
      .from("investment_ideas")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("[investments/generate] insert error:", insertError);
      // Return the generated ideas without DB ids as fallback
      return NextResponse.json(ideas);
    }

    // Map DB rows back to InvestmentIdea shape
    const result = (saved || []).map((row: Record<string, unknown>) => ({
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("[investments/generate]", error);
    return NextResponse.json({ error: "Failed to generate ideas" }, { status: 500 });
  }
}
