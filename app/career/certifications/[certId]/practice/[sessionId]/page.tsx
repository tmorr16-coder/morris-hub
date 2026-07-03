export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle, Icons } from "@/components/ios";
import PracticeSessionClient from "./_components/PracticeSessionClient";

export default async function CertPracticeSessionPage({
  params,
}: {
  params: Promise<{ certId: string; sessionId: string }>;
}) {
  const { certId, sessionId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Load session and verify ownership
  const { data: session } = await db
    .schema("student_support")
    .from("cert_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("exam_id", certId)
    .maybeSingle();

  if (!session) notFound();

  // Load exam name
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("id, name")
    .eq("id", certId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!exam) notFound();

  // Load already-answered question IDs for this session
  const { data: attemptRows } = await db
    .schema("student_support")
    .from("cert_attempts")
    .select("question_id, is_correct, selected_choice_id")
    .eq("session_id", sessionId);

  const answeredIds = new Set(
    (attemptRows ?? []).map(
      (a: { question_id: string }) => a.question_id
    )
  );
  const answeredCount = answeredIds.size;
  const totalQuestions = session.question_count as number;

  // Build domain-filtered question query
  // Domain Drill: session.domain_id set — filter to that domain
  // Multi-domain filter: session has domain_ids array (or we just use exam_id)
  // For simplicity: if domain_id is set on session, filter to it; otherwise all questions for exam
  interface QuestionRow {
    id: string;
    stem: string;
    explanation: string | null;
    difficulty: number;
    domain_id: string | null;
    cert_domains: { id: string; name: string } | null;
  }

  let nextQuestion: QuestionRow | null = null;
  let choices: { id: string; label: string; body: string }[] = [];

  // Only fetch next question if session hasn't reached its question_count limit
  if (answeredCount < totalQuestions) {
    let qQuery = db
      .schema("student_support")
      .from("cert_questions")
      .select("id, stem, explanation, difficulty, domain_id, cert_domains(id, name)")
      .eq("exam_id", certId);

    if (session.domain_id) {
      qQuery = qQuery.eq("domain_id", session.domain_id);
    }

    const { data: allQuestions } = await qQuery;

    const unanswered = (allQuestions ?? []).filter(
      (q: QuestionRow) => !answeredIds.has(q.id)
    );

    if (unanswered.length > 0) {
      // Pseudo-random pick from first 5 unanswered to add variety
      // eslint-disable-next-line react-hooks/purity -- async server component, not a React render
      const idx = Math.floor(Math.random() * Math.min(unanswered.length, 5));
      nextQuestion = unanswered[idx] as QuestionRow;

      if (nextQuestion) {
        const { data: choiceRows } = await db
          .schema("student_support")
          .from("cert_choices")
          .select("id, label, body")
          .eq("question_id", nextQuestion.id)
          .order("label");
        choices = choiceRows ?? [];
      }
    }
  }

  // For completion screen: build domain breakdown
  interface AttemptRow {
    question_id: string;
    is_correct: boolean;
    selected_choice_id: string | null;
  }

  return (
    <div className="ios-scroll">
      <Link
        href={`/career/certifications/${certId}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }}
        className="ios-subhead"
      >
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> {exam.name}
      </Link>
      <LargeTitle title="Practice Session" />
      <div style={{ padding: "4px 16px 40px" }}>
        <PracticeSessionClient
          session={{
            id: session.id,
            mode: session.mode,
            domain_id: session.domain_id ?? null,
            time_limit_s: session.time_limit_s ?? null,
            started_at: session.started_at,
          }}
          question={nextQuestion}
          choices={choices}
          totalQuestions={totalQuestions}
          answeredCount={answeredCount}
          answeredRows={(attemptRows ?? []) as AttemptRow[]}
          examName={exam.name}
          certId={certId}
        />
      </div>
    </div>
  );
}
