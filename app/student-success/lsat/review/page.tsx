export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

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
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px 100px" }}>
        <Link href="/student-success/lsat" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
          ← LSAT Prep
        </Link>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "12px 0 4px" }}>
          Blind Review Queue
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 32 }}>
          Questions you flagged — re-examine before seeing the explanation.
        </p>

        {flagged?.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏳</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No flagged questions</div>
            <div style={{ fontSize: 13 }}>Flag questions during practice to add them here.</div>
          </div>
        )}

        {unreviewed.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-amber)", marginBottom: 12 }}>
              Needs Review ({unreviewed.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {unreviewed.map((a: any) => {
                const qt = a.lsat_questions?.lsat_question_types;
                return (
                  <Link key={a.id} href={`/student-success/lsat/review/${a.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "var(--color-bg-card)", border: "1px solid var(--color-amber)",
                      borderRadius: 12, padding: "16px 20px", boxShadow: "var(--shadow-card)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-amber)", marginBottom: 6 }}>
                            {qt?.section} · {qt?.category}{qt?.subcategory ? ` (${qt.subcategory})` : ""}
                          </div>
                          <div style={{
                            fontSize: 14, color: "var(--color-ink)", lineHeight: 1.5,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                          }}>
                            {a.lsat_questions?.stem}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                            {new Date(a.answered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span style={{ fontSize: 12, color: a.is_correct ? "var(--color-green)" : "var(--color-red)", fontWeight: 600 }}>
                            {a.is_correct ? "Was correct" : "Was wrong"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {reviewed.length > 0 && (
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 12 }}>
              Reviewed ({reviewed.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {reviewed.map((a: any) => {
                const qt = a.lsat_questions?.lsat_question_types;
                return (
                  <Link key={a.id} href={`/student-success/lsat/review/${a.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
                      borderRadius: 10, padding: "14px 18px", opacity: 0.75,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
                          {qt?.category}{qt?.subcategory ? ` (${qt.subcategory})` : ""} · {a.lsat_questions?.stem?.slice(0, 60)}…
                        </div>
                        <span style={{ fontSize: 11, color: "var(--color-ink-4)", marginLeft: 12, flexShrink: 0 }}>Reviewed ✓</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
