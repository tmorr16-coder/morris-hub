"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface QuestionType {
  id: string;
  section: string;
  category: string;
  subcategory: string | null;
}

interface Props {
  userId: string;
  lrTypes: QuestionType[];
  rcTypes: QuestionType[];
  countByType: Record<string, number>;
  initialMode?: string;
  initialSection?: string;
}

const MODE_OPTIONS = [
  { value: "drill",         label: "Drill",          desc: "Practice specific question types, untimed. Good for targeted skill building." },
  { value: "timed_section", label: "Timed Section",  desc: "35-minute section under test conditions. One section of LR or RC." },
  { value: "blind_review",  label: "Blind Review",   desc: "Re-examine flagged questions without seeing the answer — the highest-yield study method." },
];

export default function PracticeSetupClient({ userId, lrTypes, rcTypes, countByType, initialMode, initialSection }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState(initialMode ?? "drill");
  const [section, setSection] = useState(initialSection ?? "LR");
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const types = section === "LR" ? lrTypes : rcTypes;
  const totalAvailable = selectedTypeIds.length > 0
    ? selectedTypeIds.reduce((sum, id) => sum + (countByType[id] ?? 0), 0)
    : types.reduce((sum, t) => sum + (countByType[t.id] ?? 0), 0);

  function toggleType(id: string) {
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/student-support/lsat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          section: mode === "blind_review" ? null : section,
          isTimed: mode === "timed_section",
          timeLimitS: mode === "timed_section" ? 2100 : null,
          typeIds: selectedTypeIds.length > 0 ? selectedTypeIds : null,
          questionCount: mode === "timed_section" ? 25 : questionCount,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to start session");
        return;
      }
      const { sessionId } = await res.json();
      router.push(`/career/lsat/session/${sessionId}`);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Mode selector */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 12 }}>
          Session Mode
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              style={{
                padding: "14px 18px", borderRadius: 10, textAlign: "left",
                border: `2px solid ${mode === opt.value ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: mode === opt.value ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: "50%", border: `2px solid ${mode === opt.value ? "var(--color-accent)" : "var(--color-ink-4)"}`,
                background: mode === opt.value ? "var(--color-accent)" : "transparent",
                flexShrink: 0, marginTop: 2,
              }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Section + type picker (drill mode only) */}
      {mode === "drill" && (
        <>
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 12 }}>
              Section
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {["LR", "RC"].map((s) => (
                <button key={s} onClick={() => { setSection(s); setSelectedTypeIds([]); }}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, fontWeight: 600, fontSize: 14,
                    border: `2px solid ${section === s ? "var(--color-accent)" : "var(--color-rule)"}`,
                    background: section === s ? "var(--color-accent-soft)" : "transparent",
                    color: section === s ? "var(--color-accent)" : "var(--color-ink-2)",
                    cursor: "pointer",
                  }}>
                  {s === "LR" ? "Logical Reasoning" : "Reading Comprehension"}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)" }}>
                Question Types <span style={{ fontWeight: 400, color: "var(--color-ink-4)" }}>(all = leave empty)</span>
              </div>
              {selectedTypeIds.length > 0 && (
                <button onClick={() => setSelectedTypeIds([])} style={{ fontSize: 11, color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {types.map((t) => {
                const label = t.subcategory ? `${t.category} (${t.subcategory})` : t.category;
                const count = countByType[t.id] ?? 0;
                const selected = selectedTypeIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleType(t.id)}
                    disabled={count === 0}
                    style={{
                      padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-rule)"}`,
                      background: selected ? "var(--color-accent)" : "transparent",
                      color: selected ? "#fff" : count === 0 ? "var(--color-ink-4)" : "var(--color-ink-2)",
                      cursor: count === 0 ? "default" : "pointer",
                      opacity: count === 0 ? 0.5 : 1,
                    }}
                  >
                    {label}
                    <span style={{ marginLeft: 5, opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 12 }}>
              Number of Questions
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[5, 10, 20, "All"].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n === "All" ? Math.min(totalAvailable, 50) : n as number)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: `1px solid ${questionCount === (n === "All" ? Math.min(totalAvailable, 50) : n) ? "var(--color-accent)" : "var(--color-rule)"}`,
                    background: questionCount === (n === "All" ? Math.min(totalAvailable, 50) : n) ? "var(--color-accent-soft)" : "transparent",
                    color: questionCount === (n === "All" ? Math.min(totalAvailable, 50) : n) ? "var(--color-accent)" : "var(--color-ink-2)",
                    cursor: "pointer",
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 8 }}>
              {totalAvailable} questions available for selected types
            </div>
          </section>
        </>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 13, color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      {totalAvailable === 0 && mode === "drill" && (
        <div style={{ padding: "12px 16px", background: "rgba(184,138,46,0.08)", border: "1px solid var(--color-amber)", borderRadius: 8, fontSize: 13, color: "var(--color-amber)" }}>
          No questions available for the selected types yet. More questions can be generated by the AI.
        </div>
      )}

      <button
        onClick={start}
        disabled={isPending || (mode === "drill" && totalAvailable === 0)}
        style={{
          padding: "14px", borderRadius: 10, background: isPending ? "var(--color-rule)" : "var(--color-accent)",
          color: "#fff", fontSize: 15, fontWeight: 600, cursor: isPending ? "default" : "pointer",
          border: "none", fontFamily: "inherit",
        }}
      >
        {isPending ? "Starting…" : mode === "blind_review" ? "Start Blind Review" : "Start Session"}
      </button>
    </div>
  );
}
