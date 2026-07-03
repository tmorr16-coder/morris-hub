/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle, Group, Cell, IconBadge, BarRows, RadialGauge, Sparkline, Icons } from "@/components/ios";

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
  const accuracyPct = total > 0 ? Math.round(correct / total * 100) : 0;

  // Calibration
  const calibMatrix = {
    confRight: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence >= 4 && a.is_correct).length,
    confWrong: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence >= 4 && !a.is_correct).length,
    unsureRight: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence < 4 && a.is_correct).length,
    unsureWrong: all.filter((a: { confidence: number; is_correct: boolean }) => a.confidence < 4 && !a.is_correct).length,
  };

  // Cumulative accuracy trend over time (chronological)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chrono = [...all].reverse() as { is_correct: boolean }[];
  const accuracyTrend: number[] = [];
  let running = 0;
  chrono.forEach((a, i) => {
    if (a.is_correct) running++;
    accuracyTrend.push(Math.round(running / (i + 1) * 100));
  });

  // Section-type accuracy
  const typeStats = new Map<string, { label: string; correct: number; total: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of all as any[]) {
    const qt = a.lsat_questions?.lsat_question_types;
    if (!qt) continue;
    const key = `${qt.section}|${qt.category}|${qt.subcategory ?? ""}`;
    const label = `${qt.section} · ${qt.category}${qt.subcategory ? ` (${qt.subcategory})` : ""}`;
    if (!typeStats.has(key)) typeStats.set(key, { label, correct: 0, total: 0 });
    const entry = typeStats.get(key)!;
    entry.total++;
    if (a.is_correct) entry.correct++;
  }
  const typeAccuracy = [...typeStats.values()]
    .filter((t) => t.total >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((t) => {
      const pct = Math.round(t.correct / t.total * 100);
      return {
        label: t.label,
        value: pct,
        display: `${pct}%`,
        color: pct >= 70 ? "#2E7D46" : pct >= 50 ? "#E08600" : "#C0392B",
      };
    });

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
    <div className="ios-scroll">
      <LargeTitle title="Analytics" subtitle={`${total} attempts · ${accuracyPct}% accuracy`} />

      {total === 0 && (
        <Group header="Analytics" footer="Complete some practice to see your analytics.">
          <Cell href="/career/lsat/practice" lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>} title="Start practicing" />
        </Group>
      )}

      {total > 0 && (
        <>
          {/* Accuracy hero — single target-progress gauge + trend */}
          <div className="ios-list" style={{ margin: "8px 16px 0", padding: "18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <RadialGauge
              value={accuracyPct / 100}
              color={accuracyPct >= 70 ? "#34C759" : accuracyPct >= 50 ? "#E08600" : "#FF3B30"}
              label="Accuracy"
              center={<span className="ios-num" style={{ fontSize: 22, fontWeight: 700 }}>{accuracyPct}%</span>}
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 0 }}>
              <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Accuracy trend</span>
              {accuracyTrend.length >= 2
                ? <Sparkline points={accuracyTrend} color="var(--ios-tint)" width={132} height={40} />
                : <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Not enough data yet</span>}
              <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>{correct}/{total} correct</span>
            </div>
          </div>

          {/* Confidence calibration */}
          <div className="ios-list" style={{ margin: "14px 16px 0", padding: "4px 0 6px" }}>
            <div className="ios-group-header" style={{ padding: "12px 16px 0" }}>Confidence calibration</div>
            <BarRows
              items={[
                { label: "Confident & right", value: calibMatrix.confRight, color: "#2E7D46" },
                { label: "Confident & wrong", value: calibMatrix.confWrong, color: "#C0392B" },
                { label: "Unsure & right", value: calibMatrix.unsureRight, color: "#E08600" },
                { label: "Unsure & wrong", value: calibMatrix.unsureWrong, color: "#8E8E93" },
              ]}
            />
            <div className="ios-footnote" style={{ padding: "0 16px", color: "var(--ios-label-2)" }}>Confident &amp; wrong is your highest-priority gap.</div>
          </div>

          {/* Section-type accuracy */}
          {typeAccuracy.length > 0 && (
            <div className="ios-list" style={{ margin: "14px 16px 0", padding: "4px 0 6px" }}>
              <div className="ios-group-header" style={{ padding: "12px 16px 0" }}>Accuracy by question type</div>
              <BarRows items={typeAccuracy} />
            </div>
          )}

          {/* Error patterns */}
          {errorsByType.length > 0 && (
            <Group header="Error patterns" footer="Wrong answers grouped by question type.">
              {errorsByType.slice(0, 10).map((e) => {
                const topTrap = Object.entries(e.traps).sort((a, b) => b[1] - a[1])[0];
                return (
                  <Cell
                    key={`${e.section}|${e.category}|${e.subcategory}`}
                    chevron={false}
                    lead={<IconBadge color="#C0392B"><Icons.TrendUpIcon /></IconBadge>}
                    title={`${e.section} · ${e.category}${e.subcategory ? ` (${e.subcategory})` : ""}`}
                    subtitle={topTrap ? `Top trap: ${TRAP_LABELS[topTrap[0]] ?? topTrap[0]} (${topTrap[1]}×)` : undefined}
                    trailing={<span className="ios-num" style={{ color: "var(--ios-red)", fontWeight: 700 }}>{e.count}</span>}
                  />
                );
              })}
            </Group>
          )}
        </>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
