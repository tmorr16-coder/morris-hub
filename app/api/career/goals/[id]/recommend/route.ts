import { Anthropic } from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

// POST: AI resource recommendations for a goal using claude-haiku-4-5
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
    .select("title, description, category, horizon")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (goalError || !goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const prompt = `I have the following career goal and need resource recommendations to help me achieve it.

Goal Title: ${goal.title}
Category: ${goal.category ?? "career"}
Horizon: ${goal.horizon ?? "medium"} (short = 0-6mo, medium = 6-24mo, long = 2yr+)
Description: ${goal.description ?? "(none provided)"}

Please recommend 6-8 specific, actionable resources that would help me achieve this goal.

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "resources": [
    {
      "title": "string",
      "type": "book|course|article|community|person|tool",
      "description": "string",
      "url_or_search": "string",
      "why": "string"
    }
  ]
}

Rules:
- type must be one of: book, course, article, community, person, tool
- url_or_search: provide a real URL if widely known, otherwise a specific Google search query
- description: 1-2 sentences on what this resource covers
- why: 1 sentence on why this specific resource helps with this goal
- Mix resource types — don't recommend only courses or only books
- Be specific: name actual books, courses, communities, tools (not just categories)
- Do not include any text outside the JSON object`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[career/goals/[id]/recommend] JSON parse error:", rawText);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[career/goals/[id]/recommend] AI error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
