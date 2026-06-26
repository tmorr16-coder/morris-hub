import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST: record a cert attempt
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, questionId, selectedChoiceId, timeSpentS } = body;

  if (!sessionId || !questionId || !selectedChoiceId) {
    return NextResponse.json(
      { error: "sessionId, questionId, and selectedChoiceId are required" },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Look up whether the selected choice is correct
  const { data: choice } = await db
    .schema("student_support")
    .from("cert_choices")
    .select("id, is_correct, question_id")
    .eq("id", selectedChoiceId)
    .maybeSingle();

  if (!choice) {
    return NextResponse.json({ error: "Invalid selectedChoiceId" }, { status: 400 });
  }

  // Verify the choice belongs to the stated question
  if (choice.question_id !== questionId) {
    return NextResponse.json({ error: "Choice does not belong to this question" }, { status: 400 });
  }

  // Fetch the correct choice for this question
  const { data: correctChoice } = await db
    .schema("student_support")
    .from("cert_choices")
    .select("id")
    .eq("question_id", questionId)
    .eq("is_correct", true)
    .maybeSingle();

  const isCorrect = choice.is_correct as boolean;

  const { data: attempt, error: insertErr } = await db
    .schema("student_support")
    .from("cert_attempts")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      question_id: questionId,
      selected_choice_id: selectedChoiceId,
      is_correct: isCorrect,
      time_spent_s: timeSpentS ?? null,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[cert-attempts POST] insert error:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    attemptId: attempt.id,
    isCorrect,
    correctChoiceId: correctChoice?.id ?? null,
  });
}
