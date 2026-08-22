import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { MODEL_DEEP } from "@/lib/models";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { attemptId, userNote } = await req.json();

  // Load attempt + question + choices + type
  const { data: attempt } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .select(`
      id, is_correct, confidence, flagged, selected_choice_id,
      lsat_questions!inner(
        stem, difficulty,
        lsat_question_types(section, category, subcategory),
        lsat_answer_choices(id, label, body, is_correct, trap_type)
      )
    `)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .single();

  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const q = attempt.lsat_questions;
  const qtype = q.lsat_question_types;
  const choices = q.lsat_answer_choices ?? [];
  const selectedChoice = choices.find((c: { id: string }) => c.id === attempt.selected_choice_id);
  const correctChoice = choices.find((c: { is_correct: boolean }) => c.is_correct);

  const prompt = `You are an expert LSAT tutor. A student just ${attempt.is_correct ? "correctly answered" : "incorrectly answered"} the following ${qtype?.section} ${qtype?.category}${qtype?.subcategory ? ` (${qtype.subcategory})` : ""} question.

QUESTION:
${q.stem}

ANSWER CHOICES:
${choices.map((c: { label: string; body: string; is_correct: boolean; trap_type: string | null }) =>
  `(${c.label}) ${c.body}${c.is_correct ? " ← CORRECT" : ""}${c.trap_type ? ` [trap: ${c.trap_type}]` : ""}`
).join("\n")}

STUDENT'S ANSWER: (${selectedChoice?.label}) ${selectedChoice?.body}
CORRECT ANSWER: (${correctChoice?.label}) ${correctChoice?.body}
STUDENT'S CONFIDENCE: ${attempt.confidence}/5
${userNote ? `\nSTUDENT'S OWN REFLECTION: "${userNote}"` : ""}

Please provide:
1. **Why the correct answer is right** — explain the logical reasoning in 2-3 sentences specific to this question type.
2. **Why the student's answer is wrong** (if incorrect) — specifically address the trap or misconception, referencing the trap_type if relevant.
3. **Key takeaway** — one actionable principle the student should remember for future ${qtype?.category} questions.

Be direct, specific, and use concrete references to the question text. Do not be generic. Treat the student as an intelligent adult preparing seriously for the LSAT.`;

  const stream = await client.messages.stream({
    model: MODEL_DEEP,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            const text = chunk.delta.text;
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        // Save AI explanation to review_notes
        await db.schema("student_support").from("lsat_review_notes").upsert({
          attempt_id: attemptId,
          ai_explanation: fullText,
          user_note: userNote ?? null,
          reviewed_at: new Date().toISOString(),
        }, { onConflict: "attempt_id" });
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new NextResponse(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
