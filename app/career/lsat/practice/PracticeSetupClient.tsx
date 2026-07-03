"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cell, Segmented, Chip, IconBadge, Icons } from "@/components/ios";

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

function CheckMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--ios-tint)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

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
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 24 }}>
      {/* Mode selector */}
      <section>
        <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Session Mode</div>
        <div className="ios-list" style={{ margin: 0 }}>
          {MODE_OPTIONS.map((opt) => (
            <Cell
              key={opt.value}
              onClick={() => setMode(opt.value)}
              chevron={false}
              lead={
                <IconBadge color={opt.value === "drill" ? "#2E7D46" : opt.value === "timed_section" ? "var(--ios-tint)" : "var(--ios-orange)"}>
                  {opt.value === "drill" ? <Icons.ChecklistIcon /> : opt.value === "timed_section" ? <Icons.ChartIcon /> : <Icons.TrendUpIcon />}
                </IconBadge>
              }
              title={opt.label}
              subtitle={opt.desc}
              trailing={mode === opt.value ? <CheckMark /> : undefined}
            />
          ))}
        </div>
      </section>

      {/* Section + type picker (drill mode only) */}
      {mode === "drill" && (
        <>
          <section>
            <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Section</div>
            <Segmented
              ariaLabel="Section"
              style={{ margin: 0 }}
              value={section as "LR" | "RC"}
              onChange={(v) => { setSection(v); setSelectedTypeIds([]); }}
              options={[
                { value: "LR", label: "Logical Reasoning" },
                { value: "RC", label: "Reading Comprehension" },
              ]}
            />
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 0 8px" }}>
              <div className="ios-group-header" style={{ padding: 0 }}>
                Question Types <span style={{ textTransform: "none", color: "var(--ios-label-3)" }}>(all = leave empty)</span>
              </div>
              {selectedTypeIds.length > 0 && (
                <button onClick={() => setSelectedTypeIds([])} className="ios-btn--plain" style={{ fontSize: 13, padding: 0 }}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {types.map((t) => {
                const label = t.subcategory ? `${t.category} (${t.subcategory})` : t.category;
                const count = countByType[t.id] ?? 0;
                const selected = selectedTypeIds.includes(t.id);
                if (count === 0) {
                  return (
                    <span key={t.id} className="ios-chip ios-chip--sm" style={{ opacity: 0.4 }}>
                      {label} ({count})
                    </span>
                  );
                }
                return (
                  <Chip key={t.id} small selected={selected} onClick={() => toggleType(t.id)}>
                    {label} <span style={{ opacity: 0.7 }}>({count})</span>
                  </Chip>
                );
              })}
            </div>
          </section>

          <section>
            <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Number of Questions</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[5, 10, 20, "All"].map((n) => {
                const target = n === "All" ? Math.min(totalAvailable, 50) : (n as number);
                return (
                  <Chip key={n} small selected={questionCount === target} onClick={() => setQuestionCount(target)}>
                    {n}
                  </Chip>
                );
              })}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 8 }}>
              {totalAvailable} questions available for selected types
            </div>
          </section>
        </>
      )}

      {error && (
        <div className="ios-footnote" style={{ color: "var(--ios-red)" }}>
          {error}
        </div>
      )}

      {totalAvailable === 0 && mode === "drill" && (
        <div className="ios-footnote" style={{ color: "var(--ios-orange)" }}>
          No questions available for the selected types yet. More questions can be generated by the AI.
        </div>
      )}

      <button
        type="button"
        onClick={start}
        disabled={isPending || (mode === "drill" && totalAvailable === 0)}
        className="ios-btn ios-btn--primary"
        style={{ opacity: isPending || (mode === "drill" && totalAvailable === 0) ? 0.5 : 1 }}
      >
        {isPending ? "Starting…" : mode === "blind_review" ? "Start Blind Review" : "Start Session"}
      </button>
    </div>
  );
}
