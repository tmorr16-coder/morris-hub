export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export default async function AnalyticsPage() {
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // All attempts with question type + selected choice trap type
  const { data: attempts } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .select(`
      id, is_correct, confidence, answered_at,
      lsat_questions!inner(
        lsat_question_types(section, category, subcategory)
      ),
      lsat_answer_choices(trap_type)
    `)
    .eq("user_id", userId)
    .order("answered_at", { ascending: false });

  const all = attempts ?? [];
  const total = all.length;
  const correct = all.filter((a: { is_correct: boolean }) => a.is_correct).length;

  // Calibration
  const calibMatrix = {
    confRight: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence >= 4 && a.is_correct).length,
    confWrong: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence >= 4 && !a.is_correct).length,
    unsureRight: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence < 4 && a.is_correct).length,
    unsureWrong: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence < 4 && !a.is_correct).length,
  };

  // Error patterns by question type (wrong answers only)
  const wrong = all.filter((a: { is_correct: boolean }) => !a.is_correct);
  const typeErrors = new Map<string, { category: string; subcategory: string | null; section: string; count: number; traps: Record<string, number> }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of wrong as any[]) {
    const qt = a.lsat_questions?.lsat_question_types;
    if (!qt) continue;
    const key = `${qt.section}|${qt.category}|${qt.subcategory ?? ""}`;
    if (!typeErrors.has(key)) typeErrors.set(key, { category: qt.category, subcategory: qt.subcategory, section: qt.section, count: 0, traps: {} });
    const entry = typeErrors.get(key)!;
    entry.count++;
    const trap = a.lsat_answer_choices?.trap_type;
    if (trap) entry.traps[trap] = (entry.traps[trap] ?? 0) + 1;
  }
  const errorsByType = [...typeErrors.values()].sort((a, b) => b.count - a.count);

  const TRAP_LABELS: Record<string, string> = {
    out_of_scope: "Out of scope", too_strong: "Too strong", reverses_logic: "Reverses logic",
    half_right: "Half right", true_but_irrelevant: "True but irrelevant", opposite: "Opposite",
    premise_restatement: "Premise restatement", unsupported_comparison: "Unsupported comparison",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 28px 80px" }}>
        <Link href="/student-success/lsat" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
          ← LSAT Prep
        </Link>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "12px 0 4px" }}>Analytics</h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 32 }}>
          {total} total attempts · {total > 0 ? Math.round(correct / total * 100) : 0}% accuracy
        </p>

        {total === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div>Complete some practice to see your analytics.</div>
          </div>
        )}

        {total > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Calibration matrix */}
            <div style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
              borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
              gridColumn: "1 / -1",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 16 }}>
                Confidence Calibration Matrix
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Confident & Right", n: calibMatrix.confRight, color: "#4A6B3A", bg: "rgba(74,107,58,0.1)", note: "Mastered ✓" },
                  { label: "Confident & Wrong", n: calibMatrix.confWrong, color: "#9A3B2A", bg: "rgba(154,59,42,0.12)", note: "⚠ Dangerous gap — highest priority" },
                  { label: "Unsure & Right",    n: calibMatrix.unsureRight, color: "#B88A2E", bg: "rgba(184,138,46,0.1)", note: "Lucky / shaky — needs reinforcement" },
                  { label: "Unsure & Wrong",    n: calibMatrix.unsureWrong, color: "#6B6258", bg: "rgba(107,98,88,0.08)", note: "Still learning" },
                ].map((c) => (
                  <div key={c.label} style={{ padding: "14px 16px", borderRadius: 10, background: c.bg, border: `1px solid ${c.color}30` }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.n}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>{c.note}</div>
                    {total > 0 && <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 4 }}>{Math.round(c.n / total * 100)}%</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Error patterns */}
            <div style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
              borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
              gridColumn: "1 / -1",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 16 }}>
                Error Patterns by Question Type
              </div>
              {errorsByType.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>No wrong answers yet — great work!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {errorsByType.slice(0, 10).map((e) => {
                    const topTrap = Object.entries(e.traps).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <div key={`${e.section}|${e.category}|${e.subcategory}`} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderRadius: 8, background: "var(--color-bg)", border: "1px solid var(--color-rule-soft)",
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                            {e.section} · {e.category}{e.subcategory ? ` (${e.subcategory})` : ""}
                          </div>
                          {topTrap && (
                            <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
                              Top trap: {TRAP_LABELS[topTrap[0]] ?? topTrap[0]} ({topTrap[1]}×)
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-red)", minWidth: 36, textAlign: "right" }}>
                          {e.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
