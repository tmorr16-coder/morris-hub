export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import ReviewClient from "./ReviewClient";

export default async function ReviewAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: attempt } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .select(`
      id, is_correct, confidence, flagged, selected_choice_id, answered_at, time_spent_s,
      lsat_questions!inner(
        id, stem, difficulty,
        lsat_question_types(section, category, subcategory),
        lsat_answer_choices(id, label, body, is_correct, trap_type)
      ),
      lsat_review_notes(id, user_note, ai_explanation, error_pattern, reviewed_at)
    `)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .single();

  if (!attempt) notFound();

  const q = attempt.lsat_questions;
  const choices = (q.lsat_answer_choices ?? []).sort(
    (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
  );
  const existingReview = attempt.lsat_review_notes?.[0] ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 28px 100px" }}>
        <Link href="/career/lsat/review" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
          ← Blind Review Queue
        </Link>
        <ReviewClient
          attempt={attempt}
          question={q}
          choices={choices}
          existingReview={existingReview}
        />
      </main>
    </div>
  );
}
