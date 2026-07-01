import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BIBLE_BOOKS } from "@/lib/bible-api";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { focus, duration, goal } = await req.json();

  const booksJson = JSON.stringify(BIBLE_BOOKS.map((b) => ({ id: b.id, name: b.name, chapters: b.chapters })));

  const prompt = `You are creating a structured Bible reading plan.

Focus: ${focus}
Duration: ${duration} days
Personal goal: ${goal || "General Bible study"}

Available books (id, name, chapters):
${booksJson}

Create a ${duration}-day reading plan. Each day should have 1-3 manageable readings (one chapter each, or a short passage).
Return ONLY valid JSON in this exact shape, no markdown:
{
  "title": "Plan title (short, specific)",
  "description": "1-2 sentence description of what this plan covers and its goal",
  "readings": [
    {
      "day": 1,
      "readings": ["Book Name Chapter", "Book Name Chapter"]
    }
  ]
}

Rules:
- readings[] must have exactly ${duration} entries (one per day)
- Each reading in the inner array must be in format "Book Name Chapter" e.g. "John 3" or "Psalms 23"
- Keep daily load light: 1-2 chapters per day for most plans, 3-4 max for intensive plans
- For multi-book plans, transition smoothly between books
- For thematic plans, choose passages that connect to the focus topic`;

  // Scale max_tokens to duration — a 365-day plan needs far more than a
  // fixed 8192-token cap, which was truncating the JSON mid-response and
  // causing "Failed to parse plan from AI" on longer durations.
  const maxTokens = Math.min(Math.max(duration * 80, 4096), 64000);

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const response = await stream.finalMessage();

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  let plan;
  try {
    plan = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    const reason = response.stop_reason === "max_tokens"
      ? "Plan generation ran out of room — try a shorter duration."
      : "Failed to parse plan from AI";
    return new NextResponse(reason, { status: 500 });
  }

  const db = createServiceClient() as any;
  const { data, error } = await db.schema("bible").from("reading_plans").insert({
    user_id: user.id,
    title: plan.title,
    description: plan.description,
    is_ai_generated: true,
    is_public: false,
    duration_days: duration,
    readings: plan.readings,
  }).select("id").single();

  if (error) return new NextResponse(error.message, { status: 500 });

  // Auto-enroll
  await db.schema("bible").from("user_plans").upsert({
    user_id: user.id,
    plan_id: data.id,
  }, { onConflict: "user_id,plan_id" });

  return NextResponse.json({ planId: data.id });
}
