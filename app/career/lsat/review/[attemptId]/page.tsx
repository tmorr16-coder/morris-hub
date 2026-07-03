export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
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
  const qt = q.lsat_question_types;
  const choices = (q.lsat_answer_choices ?? []).sort(
    (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
  );
  const existingReview = attempt.lsat_review_notes?.[0] ?? null;

  return (
    <div className="ios-scroll">
      <Link href="/career/lsat/review" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Review
      </Link>

      <LargeTitle
        title={qt?.category ?? "Review"}
        subtitle={[qt?.section, qt?.subcategory].filter(Boolean).join(" · ") || undefined}
      />

      <Group header="Attempt">
        <Cell
          chevron={false}
          lead={<IconBadge color={attempt.is_correct ? "var(--ios-green)" : "var(--ios-red)"}><Icons.ChecklistIcon /></IconBadge>}
          title="Result"
          trailing={<span className="ios-subhead" style={{ color: attempt.is_correct ? "var(--ios-green)" : "var(--ios-red)", fontWeight: 600 }}>{attempt.is_correct ? "Correct" : "Wrong"}</span>}
        />
        {attempt.confidence != null && (
          <Cell chevron={false} lead={<IconBadge color="var(--ios-tint)"><Icons.TrendUpIcon /></IconBadge>} title="Confidence" trailing={<span className="ios-num">{attempt.confidence}/5</span>} />
        )}
        {attempt.time_spent_s != null && (
          <Cell chevron={false} lead={<IconBadge color="#8E8E93"><Icons.ChartIcon /></IconBadge>} title="Time spent" trailing={<span className="ios-num">{Math.round(attempt.time_spent_s)}s</span>} />
        )}
        {q.difficulty != null && (
          <Cell chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.BookIcon /></IconBadge>} title="Difficulty" trailing={<span className="ios-num">{q.difficulty}</span>} />
        )}
      </Group>

      <div style={{ padding: "0 16px" }}>
        <ReviewClient
          attempt={attempt}
          question={q}
          choices={choices}
          existingReview={existingReview}
        />
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}
