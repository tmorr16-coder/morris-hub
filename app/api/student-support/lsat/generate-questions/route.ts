import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

const client = new Anthropic();

const TRAP_TYPES = [
  "out_of_scope", "too_strong", "reverses_logic", "half_right",
  "true_but_irrelevant", "opposite", "premise_restatement", "unsupported_comparison",
] as const;

export async function POST(req: NextRequest) {
  await getCurrentUserId(); // auth check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { typeId, count = 3 } = await req.json();
  if (!typeId) return NextResponse.json({ error: "typeId required" }, { status: 400 });

  const { data: qtype } = await db
    .schema("student_support")
    .from("lsat_question_types")
    .select("section, category, subcategory, description")
    .eq("id", typeId)
    .single();

  if (!qtype) return NextResponse.json({ error: "Question type not found" }, { status: 404 });

  const label = `${qtype.category}${qtype.subcategory ? ` (${qtype.subcategory})` : ""}`;
  const trapList = TRAP_TYPES.join(", ");

  const prompt = `You are an expert LSAT question writer with 20 years of experience creating official test prep material. Generate ${count} high-quality ${qtype.section} ${label} question${count > 1 ? "s" : ""} that are realistic, challenging, and pedagogically sound.

For each question, return a JSON object with this exact structure:
{
  "stem": "Full question text including any argument/stimulus and the question itself (use \\n for line breaks)",
  "difficulty": 3,  // 1=easy, 2=moderate, 3=hard, 4=very hard, 5=expert
  "choices": [
    { "label": "A", "body": "Answer choice text", "is_correct": false, "trap_type": "too_strong" },
    { "label": "B", "body": "Answer choice text", "is_correct": true, "trap_type": null },
    { "label": "C", "body": "Answer choice text", "is_correct": false, "trap_type": "out_of_scope" },
    { "label": "D", "body": "Answer choice text", "is_correct": false, "trap_type": "reverses_logic" },
    { "label": "E", "body": "Answer choice text", "is_correct": false, "trap_type": "half_right" }
  ]
}

Rules:
- Exactly 5 choices (A–E), exactly 1 correct answer
- trap_type must be null for the correct choice and one of: ${trapList} for incorrect choices
- The stimulus/argument should be 3–6 sentences, realistic and self-contained
- Question stem should match the ${label} type precisely
- Wrong answers must be plausible distractors, not obviously wrong
- Difficulty ${count > 1 ? "should vary across the questions" : "3 (hard)"}
- LSAT-style: precise, unambiguous, no tricks outside of the answer choices

Return ONLY a JSON array of ${count} question object${count > 1 ? "s" : ""}, no other text.`;

  let generated: {
    stem: string;
    difficulty: number;
    choices: { label: string; body: string; is_correct: boolean; trap_type: string | null }[];
  }[] = [];

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");
    generated = JSON.parse(jsonMatch[0]);
  } catch (err) {
    return NextResponse.json({ error: `AI generation failed: ${err instanceof Error ? err.message : err}` }, { status: 500 });
  }

  const saved: string[] = [];

  for (const q of generated) {
    const { data: question, error: qErr } = await db
      .schema("student_support")
      .from("lsat_questions")
      .insert({
        type_id: typeId,
        source: "AI-generated",
        stem: q.stem,
        difficulty: Math.max(1, Math.min(5, Math.round(q.difficulty ?? 3))),
        is_official: false,
      })
      .select("id")
      .single();

    if (qErr || !question) continue;

    for (const c of q.choices ?? []) {
      await db
        .schema("student_support")
        .from("lsat_answer_choices")
        .insert({
          question_id: question.id,
          label: c.label,
          body: c.body,
          is_correct: !!c.is_correct,
          trap_type: c.is_correct ? null : (TRAP_TYPES.includes(c.trap_type as typeof TRAP_TYPES[number]) ? c.trap_type : null),
        });
    }

    saved.push(question.id);
  }

  return NextResponse.json({ generated: saved.length, questionIds: saved });
}
