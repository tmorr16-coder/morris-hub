"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Mode selector */}
      <section>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-ink-3)",
            marginBottom: 12,
          }}
        >
          Session Mode
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              style={{
                padding: "14px 18px",
                borderRadius: 10,
                textAlign: "left",
                border: `2px solid ${mode === opt.value ? "var(--color-accent)" : "var(--color-rule)"}`,
                background:
                  mode === opt.value
                    ? "var(--color-accent-soft)"
                    : "var(--color-bg-card)",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${mode === opt.value ? "var(--color-accent)" : "var(--color-ink-4)"}`,
                  background:
                    mode === opt.value ? "var(--color-accent)" : "transparent",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-ink)",
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink-3)",
                    marginTop: 2,
                  }}
                >
                  {opt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Time limit — only for timed_mock */}
      {mode === "timed_mock" && (
        <section>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-ink-3)",
              marginBottom: 12,
            }}
          >
            Time Limit
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[15, 30, 45, 60, 90].map((min) => (
              <button
                key={min}
                onClick={() => setTimeLimitMin(min)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${timeLimitMin === min ? "var(--color-accent)" : "var(--color-rule)"}`,
                  background:
                    timeLimitMin === min
                      ? "var(--color-accent-soft)"
                      : "transparent",
                  color:
                    timeLimitMin === min
                      ? "var(--color-accent)"
                      : "var(--color-ink-2)",
                  cursor: "pointer",
                }}
              >
                {min} min
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Domain Drill — single domain dropdown */}
      {mode === "domain_drill" && (
        <section>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-ink-3)",
              marginBottom: 12,
            }}
          >
            Domain
          </div>
          {domains.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-ink-3)" }}>
              No domains defined for this exam yet.
            </p>
          ) : (
            <select
              value={drillDomainId}
              onChange={(e) => setDrillDomainId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)",
                color: "var(--color-ink)",
                fontSize: 14,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.weight_pct ? ` (${d.weight_pct}%)` : ""} —{" "}
                  {availableForDomain(d.id)} questions
                </option>
              ))}
            </select>
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
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-ink-3)",
              }}
            >
              Domains{" "}
              <span style={{ fontWeight: 400, color: "var(--color-ink-4)" }}>
                (leave empty = all)
              </span>
            </div>
            {selectedDomainIds.length > 0 && (
              <button
                onClick={() => setSelectedDomainIds([])}
                style={{
                  fontSize: 11,
                  color: "var(--color-accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {domains.map((d) => {
              const count = countByDomain[d.id] ?? 0;
              const checked = selectedDomainIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-rule)"}`,
                    background: checked
                      ? "var(--color-accent-soft)"
                      : "var(--color-bg-card)",
                    cursor: count === 0 ? "default" : "pointer",
                    opacity: count === 0 ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={count === 0}
                    onChange={() => toggleDomain(d.id)}
                    style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--color-ink)",
                      }}
                    >
                      {d.name}
                      {d.weight_pct ? (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 11,
                            color: "var(--color-ink-3)",
                            fontWeight: 400,
                          }}
                        >
                          {d.weight_pct}% of exam
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    style={{ fontSize: 11, color: "var(--color-ink-4)" }}
                  >
                    {count} q
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* Question count */}
      <section>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-ink-3)",
            marginBottom: 12,
          }}
        >
          Number of Questions
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {PRESET_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setQuestionCount(n);
                setCustomCount(null);
              }}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                border: `1px solid ${effectiveCount === n && customCount === null ? "var(--color-accent)" : "var(--color-rule)"}`,
                background:
                  effectiveCount === n && customCount === null
                    ? "var(--color-accent-soft)"
                    : "transparent",
                color:
                  effectiveCount === n && customCount === null
                    ? "var(--color-accent)"
                    : "var(--color-ink-2)",
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Custom slider */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "var(--color-ink-3)",
              marginBottom: 6,
            }}
          >
            <span>Custom</span>
            <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>
              {customCount !== null ? customCount : "—"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(availableTotal, 1)}
            value={customCount ?? effectiveCount}
            onChange={(e) => setCustomCount(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--color-accent)" }}
          />
          <div
            style={{
              fontSize: 11,
              color: "var(--color-ink-4)",
              marginTop: 4,
            }}
          >
            {availableTotal} questions available
          </div>
        </div>
      </section>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(154,59,42,0.08)",
            border: "1px solid var(--color-red)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--color-red)",
          }}
        >
          {error}
        </div>
      )}

      {availableTotal === 0 && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(184,138,46,0.08)",
            border: "1px solid var(--color-amber)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--color-amber)",
          }}
        >
          No questions available yet. Generate questions from the certification
          page.
        </div>
      )}

      <button
        onClick={start}
        disabled={isPending || availableTotal === 0}
        style={{
          padding: "14px",
          borderRadius: 10,
          background:
            isPending || availableTotal === 0
              ? "var(--color-rule)"
              : "var(--color-accent)",
          color:
            isPending || availableTotal === 0
              ? "var(--color-ink-4)"
              : "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: isPending || availableTotal === 0 ? "default" : "pointer",
          border: "none",
          fontFamily: "inherit",
        }}
      >
        {isPending ? "Starting…" : "Start Session"}
      </button>
    </div>
  );
}
