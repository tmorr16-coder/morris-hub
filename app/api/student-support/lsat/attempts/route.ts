import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { sessionId, questionId, selectedChoiceId, confidence, flagged, timeSpentS } = await req.json();

  // Verify the selected choice and get the correct answer
  const { data: choice } = await db
    .schema("student_support")
    .from("lsat_answer_choices")
    .select("id, is_correct, question_id")
    .eq("id", selectedChoiceId)
    .single();

  if (!choice) return NextResponse.json({ error: "Invalid choice" }, { status: 400 });

  const { data: correctChoice } = await db
    .schema("student_support")
    .from("lsat_answer_choices")
    .select("id")
    .eq("question_id", choice.question_id)
    .eq("is_correct", true)
    .single();

  const isCorrect = choice.is_correct;

  const { data: attempt, error } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .insert({
      session_id: sessionId,
      user_id: userId,
      question_id: questionId,
      selected_choice_id: selectedChoiceId,
      is_correct: isCorrect,
      confidence: confidence ?? null,
      time_spent_s: timeSpentS ?? null,
      flagged: flagged ?? false,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    attemptId: attempt.id,
    isCorrect,
    correctChoiceId: correctChoice?.id ?? null,
  });
}
