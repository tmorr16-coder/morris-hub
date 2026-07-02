export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import SessionClient from "./SessionClient";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Load session + verify ownership
  const { data: session } = await db
    .schema("student_support")
    .from("lsat_practice_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!session) notFound();
  if (session.ended_at) redirect("/career/lsat");

  // Load previously answered question IDs for this session
  const { data: answeredRows } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .select("question_id, id, is_correct, confidence, flagged, selected_choice_id")
    .eq("session_id", sessionId);

  const answeredIds = new Set((answeredRows ?? []).map((a: { question_id: string }) => a.question_id));

  // Load the next question(s) — pick randomly from available pool
  // For drill mode: any question not yet answered in this session
  // For blind_review: flagged unanswered questions
  interface ChoiceRow { id: string; label: string; body: string; }
  let nextQuestion = null;
  let nextChoices: ChoiceRow[] = [];

  if (session.mode === "blind_review") {
    // Get flagged attempts not yet reviewed
    const { data: flagged } = await db
      .schema("student_support")
      .from("lsat_attempts")
      .select("question_id, id")
      .eq("user_id", userId)
      .eq("flagged", true)
      .not("question_id", "in", `(${[...answeredIds].join(",") || "00000000-0000-0000-0000-000000000000"})`)
      .limit(1);

    if (flagged?.[0]) {
      const { data: q } = await db
        .schema("student_support")
        .from("lsat_questions")
        .select("*, lsat_question_types(section, category, subcategory)")
        .eq("id", flagged[0].question_id)
        .single();
      nextQuestion = q;

      const { data: choices } = await db
        .schema("student_support")
        .from("lsat_answer_choices")
        .select("id, label, body")  // NOT is_correct — blind review hides the answer initially
        .eq("question_id", q.id)
        .order("label");
      nextChoices = choices ?? [];
    }
  } else {
    // Regular drill — get questions for this session's type filters
    const { data: allQ } = await db
      .schema("student_support")
      .from("lsat_questions")
      .select("id, stem, difficulty, type_id, lsat_question_types(section, category, subcategory)")
      .eq("lsat_question_types.section", session.section ?? "LR");

    const unanswered = (allQ ?? []).filter((q: { id: string }) => !answeredIds.has(q.id));

    if (unanswered.length > 0) {
      // Pick a question (pseudo-random based on index)
      const idx = Math.floor(Math.random() * Math.min(unanswered.length, 5));
      nextQuestion = unanswered[idx];

      if (nextQuestion) {
        const { data: choices } = await db
          .schema("student_support")
          .from("lsat_answer_choices")
          .select("id, label, body")
          .eq("question_id", nextQuestion.id)
          .order("label");
        nextChoices = choices ?? [];
      }
    }
  }

  const totalAnswered = answeredRows?.length ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 28px 100px" }}>
        <SessionClient
          session={session}
          nextQuestion={nextQuestion}
          nextChoices={nextChoices}
          totalAnswered={totalAnswered}
          answeredRows={answeredRows ?? []}
        />
      </main>
    </div>
  );
}
