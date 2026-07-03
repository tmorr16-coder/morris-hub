export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

export default async function ReviewListPage() {
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: flagged } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .select(`
      id, is_correct, confidence, answered_at, flagged,
      lsat_questions!inner(stem, lsat_question_types(category, subcategory, section)),
      lsat_review_notes(id, reviewed_at, error_pattern)
    `)
    .eq("user_id", userId)
    .eq("flagged", true)
    .order("answered_at", { ascending: false });

  const unreviewed = (flagged ?? []).filter((a: { lsat_review_notes: { id: string }[] | null }) => !a.lsat_review_notes?.length);
  const reviewed = (flagged ?? []).filter((a: { lsat_review_notes: { id: string }[] | null }) => a.lsat_review_notes?.length);

  return (
    <div className="ios-scroll">
      <Link href="/career/lsat" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> LSAT
      </Link>

      <LargeTitle title="Review" subtitle="Questions you flagged — re-examine before the explanation." />

      {(flagged?.length ?? 0) === 0 && (
        <Group header="Blind review queue" footer="Flag questions during practice to add them here.">
          <Cell href="/career/lsat/practice" lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>} title="Start practicing" />
        </Group>
      )}

      {unreviewed.length > 0 && (
        <Group header={`Needs review (${unreviewed.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {unreviewed.map((a: any) => {
            const qt = a.lsat_questions?.lsat_question_types;
            return (
              <Cell
                key={a.id}
                href={`/career/lsat/review/${a.id}`}
                lead={<IconBadge color="var(--ios-orange)"><Icons.ChecklistIcon /></IconBadge>}
                title={`${qt?.section ?? ""} · ${qt?.category ?? "Flagged"}${qt?.subcategory ? ` (${qt.subcategory})` : ""}`}
                subtitle={new Date(a.answered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                trailing={<span className="ios-subhead" style={{ color: a.is_correct ? "var(--ios-green)" : "var(--ios-red)", fontWeight: 600 }}>{a.is_correct ? "Was right" : "Was wrong"}</span>}
              />
            );
          })}
        </Group>
      )}

      {reviewed.length > 0 && (
        <Group header={`Reviewed (${reviewed.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {reviewed.map((a: any) => {
            const qt = a.lsat_questions?.lsat_question_types;
            return (
              <Cell
                key={a.id}
                href={`/career/lsat/review/${a.id}`}
                lead={<IconBadge color="#8E8E93"><Icons.ChecklistIcon /></IconBadge>}
                title={`${qt?.category ?? "Reviewed"}${qt?.subcategory ? ` (${qt.subcategory})` : ""}`}
                subtitle={`${a.lsat_questions?.stem?.slice(0, 60) ?? ""}…`}
                trailing={<span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Reviewed</span>}
              />
            );
          })}
        </Group>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
