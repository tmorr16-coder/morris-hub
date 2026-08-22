import { Anthropic } from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { MODEL_FAST } from "@/lib/models";

const client = new Anthropic();

// POST: AI goal refinement using claude-haiku-4-5
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Fetch the goal
  const { data: goal, error: goalError } = await db
    .schema("career")
    .from("career_goals")
    .select("title, description, why, success_criteria, horizon, target_date, category, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (goalError || !goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const prompt = `Here is a career goal I want to refine:

Title: ${goal.title}
Category: ${goal.category ?? "career"}
Horizon: ${goal.horizon ?? "medium"} (short = 0-6mo, medium = 6-24mo, long = 2yr+)
Target Date: ${goal.target_date ?? "not set"}
Status: ${goal.status ?? "active"}

Description:
${goal.description ?? "(none provided)"}

Why this matters (motivation):
${goal.why ?? "(none provided)"}

Current success criteria:
${goal.success_criteria ?? "(none provided)"}

Please refine this goal to be SMART (Specific, Measurable, Achievable, Relevant, Time-bound).

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "refined_title": "string",
  "refined_description": "string",
  "success_criteria": ["string", "string", "string"],
  "milestones": [
    {"title": "string", "offset_days": number}
  ],
  "coaching_note": "string"
}

Rules:
- success_criteria: 3-5 concrete, measurable items
- milestones: 3-5 specific milestones with offset_days relative to target_date (negative means before target, e.g. -90 = 90 days before target)
- coaching_note: 1-2 sentences of encouragement and key insight
- Do not include any text outside the JSON object`;

  try {
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 1024,
      system:
        "You are a career development coach helping refine goals to be specific, measurable, achievable, relevant, and time-bound (SMART).",
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[career/goals/[id]/refine] JSON parse error:", rawText);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[career/goals/[id]/refine] AI error:", error);
    return NextResponse.json(
      { error: "Failed to refine goal" },
      { status: 500 }
    );
  }
}
