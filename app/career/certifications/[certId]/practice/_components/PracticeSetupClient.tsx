"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Segmented, Chip, Cell } from "@/components/ios";

interface Domain {
  id: string;
  name: string;
  weight_pct: number;
  sort_order: number;
}

interface Props {
  certId: string;
  examName: string;
  domains: Domain[];
  countByDomain: Record<string, number>;
  totalQuestions: number;
}

const MODE_OPTIONS = [
  {
    value: "practice",
    label: "Practice",
    desc: "Untimed. Answer at your own pace — great for learning.",
  },
  {
    value: "timed_mock",
    label: "Timed Mock",
    desc: "Set a time limit and simulate exam conditions.",
  },
  {
    value: "domain_drill",
    label: "Domain Drill",
    desc: "Focus on a single domain to target weak areas.",
  },
];

const PRESET_COUNTS = [10, 20, 40] as const;
const TIME_PRESETS = [15, 30, 45, 60, 90];

// Uppercase grouped-list-style section header, no horizontal inset (parent pads).
const sectionHeader: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  lineHeight: "18px",
  color: "var(--ios-label-2)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  marginBottom: 8,
};

function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ios-tint)"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function PracticeSetupClient({
  certId,
  domains,
  countByDomain,
  totalQuestions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState("practice");
  const [questionCount, setQuestionCount] = useState(10);
  const [customCount, setCustomCount] = useState<number | null>(null);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [drillDomainId, setDrillDomainId] = useState<string>(domains[0]?.id ?? "");
  const [timeLimitMin, setTimeLimitMin] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const effectiveCount = customCount ?? questionCount;

  // How many questions are available given current filters
  const availableForDomain = (domainId: string) => countByDomain[domainId] ?? 0;

  const availableTotal =
    mode === "domain_drill"
      ? availableForDomain(drillDomainId)
      : selectedDomainIds.length > 0
      ? selectedDomainIds.reduce((s, id) => s + (countByDomain[id] ?? 0), 0)
      : totalQuestions;

  function toggleDomain(id: string) {
    setSelectedDomainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function start() {
    setError(null);

    const domainId =
      mode === "domain_drill" ? drillDomainId || null : null;

    const domainIds =
      mode !== "domain_drill" && selectedDomainIds.length > 0
        ? selectedDomainIds
        : null;

    const timeLimitS =
      mode === "timed_mock" ? timeLimitMin * 60 : null;

    startTransition(async () => {
      const res = await fetch(
        `/api/student-support/certifications/${certId}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            domainId,
            domainIds,
            questionCount: effectiveCount,
            timeLimitS,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to start session");
        return;
      }

      const session = await res.json();
      router.push(
        `/career/certifications/${certId}/practice/${session.id}`
      );
    });
  }

  const selectedModeDesc = MODE_OPTIONS.find((o) => o.value === mode)?.desc;
  const startDisabled = isPending || availableTotal === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Mode selector */}
      <section>
        <div style={sectionHeader}>Session Mode</div>
        <Segmented
          options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={mode}
          onChange={setMode}
          ariaLabel="Session mode"
        />
        {selectedModeDesc && (
          <div
            className="ios-footnote"
            style={{ color: "var(--ios-label-2)", marginTop: 8, lineHeight: 1.5 }}
          >
            {selectedModeDesc}
          </div>
        )}
      </section>

      {/* Time limit — only for timed_mock */}
      {mode === "timed_mock" && (
        <section>
          <div style={sectionHeader}>Time Limit</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIME_PRESETS.map((min) => (
              <Chip
                key={min}
                selected={timeLimitMin === min}
                onClick={() => setTimeLimitMin(min)}
              >
                {min} min
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* Domain Drill — single domain picker */}
      {mode === "domain_drill" && (
        <section>
          <div style={sectionHeader}>Domain</div>
          {domains.length === 0 ? (
            <p className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
              No domains defined for this exam yet.
            </p>
          ) : (
            <div className="ios-list" style={{ margin: 0 }}>
              {domains.map((d) => {
                const count = availableForDomain(d.id);
                const selected = drillDomainId === d.id;
                return (
                  <Cell
                    key={d.id}
                    title={d.name}
                    subtitle={d.weight_pct ? `${d.weight_pct}% of exam` : undefined}
                    onClick={() => setDrillDomainId(d.id)}
                    chevron={false}
                    trailing={
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className="ios-footnote ios-num"
                          style={{ color: "var(--ios-label-2)" }}
                        >
                          {count} q
                        </span>
                        {selected && <Check />}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Domain filter (multi-select) — practice and timed_mock */}
      {mode !== "domain_drill" && domains.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={sectionHeader}>
              Domains{" "}
              <span style={{ color: "var(--ios-label-3)" }}>(leave empty = all)</span>
            </div>
            {selectedDomainIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDomainIds([])}
                className="ios-btn--plain"
                style={{ padding: 0, fontSize: 13 }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="ios-list" style={{ margin: 0 }}>
            {domains.map((d) => {
              const count = countByDomain[d.id] ?? 0;
              const checked = selectedDomainIds.includes(d.id);
              const disabled = count === 0;
              return (
                <Cell
                  key={d.id}
                  title={d.name}
                  subtitle={d.weight_pct ? `${d.weight_pct}% of exam` : undefined}
                  onClick={disabled ? undefined : () => toggleDomain(d.id)}
                  chevron={false}
                  trailing={
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className="ios-footnote ios-num"
                        style={{
                          color: disabled ? "var(--ios-label-3)" : "var(--ios-label-2)",
                        }}
                      >
                        {count} q
                      </span>
                      {checked && <Check />}
                    </span>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Question count */}
      <section>
        <div style={sectionHeader}>Number of Questions</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {PRESET_COUNTS.map((n) => (
            <Chip
              key={n}
              selected={effectiveCount === n && customCount === null}
              onClick={() => {
                setQuestionCount(n);
                setCustomCount(null);
              }}
            >
              {n}
            </Chip>
          ))}
        </div>

        {/* Custom slider */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
              Custom
            </span>
            <span
              className="ios-headline ios-num"
              style={{ color: "var(--ios-label)" }}
            >
              {customCount !== null ? customCount : "—"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(availableTotal, 1)}
            value={customCount ?? effectiveCount}
            onChange={(e) => setCustomCount(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--ios-tint)" }}
          />
          <div
            className="ios-footnote ios-num"
            style={{ color: "var(--ios-label-3)", marginTop: 4 }}
          >
            {availableTotal} questions available
          </div>
        </div>
      </section>

      {error && (
        <div
          className="ios-footnote"
          style={{
            padding: "11px 14px",
            background: "var(--ios-fill)",
            border: "var(--ios-hair) solid var(--ios-red)",
            borderRadius: 12,
            color: "var(--ios-red)",
          }}
        >
          {error}
        </div>
      )}

      {availableTotal === 0 && (
        <div
          className="ios-footnote"
          style={{
            padding: "12px 16px",
            background: "var(--ios-fill)",
            border: "var(--ios-hair) solid var(--ios-orange)",
            borderRadius: 12,
            color: "var(--ios-orange)",
          }}
        >
          No questions available yet. Generate questions from the certification
          page.
        </div>
      )}

      <button
        type="button"
        onClick={start}
        disabled={startDisabled}
        className="ios-btn ios-btn--primary"
        style={{ opacity: startDisabled ? 0.4 : 1 }}
      >
        {isPending ? "Starting…" : "Start Session"}
      </button>
    </div>
  );
}
