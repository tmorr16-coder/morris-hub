"use client";

import { useState, useMemo, useEffect } from "react";
import TrendChart from "./TrendChart";

// ── Design tokens ────────────────────────────────────────────────
const C_SLATE  = "#2f3a47";
const C_MOSS   = "#4a6a4d";
const C_ACCENT = "#b84a2e";

// ── Mock data (replaced when body-scan / lift-tracking integration exists) ───
const MOCK_WEEKS_AGO  = [-12, -9, -6, -3, 0];
const MOCK_WEIGHTS    = [191.8, 189.4, 187.1, 185.5, 184.2];
const MOCK_MUSCLES    = [140.4, 140.9, 141.3, 141.7, 142.1];
const MOCK_FATS       = [19.2,  18.6,  17.9,  17.3,  16.8];

const MOCK_LIFT_PRS = [
  { name: "Back Squat",      val: 245, delta: "+15" },
  { name: "Romanian DL",     val: 215, delta: "+10" },
  { name: "Bench Press",     val: 195, delta: "+5"  },
  { name: "Overhead Press",  val: 125, delta: "+5"  },
];

// ── Props from server ─────────────────────────────────────────────
export interface FeedItem {
  id: string;
  date: string;
  type: "workout" | "meal";
  label: string;
  detail: string | null;
  icon: string;
}

export interface BiaPoint {
  ts: string;
  label: string;
  weight: number | null;
  muscle: number | null;
  fat: number | null;
}

export interface ProgressProps {
  withingsCurrent: number | null;
  withingsDelta30d: number | null;
  weeklyMiles: number | null;
  weeklyRuns: number;
  avgPaceSec: number | null;
  streak: number;
  monthWorkouts: number;
  last7Steps: { day: string; steps: number }[];
  feedItems: FeedItem[];
  serverTargetWeightLbs: number | null;
  biaPoints?: BiaPoint[];
  biaHasData?: boolean;
}

function relativeDay(dateStr: string): string {
  const fmt = (d: Date) => d.toLocaleDateString("sv");
  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtPace(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Segmented control ─────────────────────────────────────────────
type Tab = "body" | "lifts" | "cardio";

function Seg({ value, options, onChange }: {
  value: string;
  options: { k: Tab; l: string }[];
  onChange: (v: Tab) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--color-bg-sunk)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
        marginBottom: 16,
      }}
    >
      {options.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          style={{
            flex: 1,
            padding: "7px 0",
            borderRadius: 8,
            border: "none",
            background: value === o.k ? "var(--color-bg-raised)" : "transparent",
            color: value === o.k ? "var(--color-ink)" : "var(--color-ink-3)",
            fontSize: 12,
            fontWeight: value === o.k ? 600 : 400,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: value === o.k ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
            transition: "background 120ms",
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ── Stat block ────────────────────────────────────────────────────
function StatBlock({
  label, value, unit, delta, deltaGood,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaGood?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg-sunk)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>{unit}</span>
        )}
      </div>
      {delta && (
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            marginTop: 4,
            color: deltaGood ? "var(--color-moss)" : "var(--color-ink-3)",
          }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function ProgressClient({
  withingsCurrent,
  withingsDelta30d,
  weeklyMiles,
  weeklyRuns,
  avgPaceSec,
  streak,
  monthWorkouts,
  last7Steps,
  feedItems,
  serverTargetWeightLbs,
  biaPoints = [],
  biaHasData = false,
}: ProgressProps) {
  const [tab, setTab] = useState<Tab>("body");
  // Seed from server (Supabase user_metadata); localStorage overrides if user set it locally
  const [targetWeightLbs, setTargetWeightLbs] = useState<number | null>(serverTargetWeightLbs);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("health-dashboard-profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        const t = parseFloat(parsed.targetWeightLbs);
        if (!isNaN(t) && t > 0) setTargetWeightLbs(t);
      }
    } catch { /* ignore */ }
  }, []);

  // Use real Withings BIA data when available, fall back to mock
  const bodyData = useMemo(() => {
    if (biaHasData && biaPoints.length >= 2) {
      // DataPoint index signature requires number|Date — omit null metrics
      return biaPoints.map((p) => {
        const pt: { date: Date; [k: string]: number | Date } = { date: new Date(p.ts) };
        if (p.weight != null) pt.weight = p.weight;
        if (p.muscle != null) pt.muscle = p.muscle;
        if (p.fat    != null) pt.fat    = p.fat;
        return pt;
      });
    }
    // Fallback to mock with current weight offset
    return MOCK_WEEKS_AGO.map((weeksAgo, i) => {
      const d = new Date();
      d.setDate(d.getDate() + weeksAgo * 7);
      const realCurrent = withingsCurrent ?? MOCK_WEIGHTS[MOCK_WEIGHTS.length - 1];
      const mockCurrent = MOCK_WEIGHTS[MOCK_WEIGHTS.length - 1];
      const offset = realCurrent - mockCurrent;
      return {
        date: d,
        weight: MOCK_WEIGHTS[i] + offset,
        muscle: MOCK_MUSCLES[i],
        fat: MOCK_FATS[i],
      };
    });
  }, [biaHasData, biaPoints, withingsCurrent]);

  // Body comp stats (bottom section, always visible)
  const currentWeight = withingsCurrent ?? MOCK_WEIGHTS[MOCK_WEIGHTS.length - 1];
  const weightDelta = withingsDelta30d != null
    ? `${withingsDelta30d > 0 ? "+" : ""}${withingsDelta30d.toFixed(1)} lb · 30d`
    : `−${(MOCK_WEIGHTS[0] - MOCK_WEIGHTS[4]).toFixed(1)} lb · 12 wks`;
  const weightDeltaGood = withingsDelta30d != null ? withingsDelta30d < 0 : true;

  return (
    <div style={{ padding: "20px 20px 0" }}>

      {/* Header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        Progress
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--color-ink)",
          marginBottom: 20,
        }}
      >
        How you&apos;re
        <br />trending.
      </div>

      {/* Streak + monthly workouts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            background: streak > 0 ? "var(--color-ink)" : "var(--color-bg-raised)",
            border: `1px solid ${streak > 0 ? "transparent" : "var(--color-line)"}`,
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: streak > 0 ? "rgba(244,241,236,0.45)" : "var(--color-ink-3)", marginBottom: 6 }}>
            Streak 🔥
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em", color: streak > 0 ? "var(--color-bg)" : "var(--color-ink-4)" }}>
            {streak}
          </div>
          <div style={{ fontSize: 11, color: streak > 0 ? "rgba(244,241,236,0.5)" : "var(--color-ink-4)", marginTop: 3 }}>
            {streak === 1 ? "day" : "days"} in a row
          </div>
        </div>
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
            This month
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--color-ink)" }}>
            {monthWorkouts}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 3 }}>
            workout{monthWorkouts !== 1 ? "s" : ""} logged
          </div>
        </div>
      </div>

      {/* 7-day step trend */}
      {last7Steps.some((d) => d.steps > 0) && (
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 14,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
            Steps · 7-day trend
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 56 }}>
            {(() => {
              const maxS = Math.max(...last7Steps.map((d) => d.steps), 1);
              return last7Steps.map(({ day, steps: s }) => (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                    <div style={{ width: "100%", height: s > 0 ? `${Math.max((s / maxS) * 100, 8)}%` : 4, background: s > 0 ? C_MOSS : "var(--color-bg-sunk)", borderRadius: "3px 3px 2px 2px" }} />
                  </div>
                  <span style={{ fontSize: 9, color: "var(--color-ink-4)", fontWeight: 500 }}>{day}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Tab control */}
      <Seg
        value={tab}
        options={[
          { k: "body",   l: "Body"   },
          { k: "lifts",  l: "Lifts"  },
          { k: "cardio", l: "Cardio" },
        ]}
        onChange={setTab}
      />

      {/* ── Body tab ─────────────────────────────────────────── */}
      {tab === "body" && (
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 14,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <TrendChart
            data={bodyData}
            height={220}
            metrics={[
              { key: "weight", label: "Weight",    color: C_SLATE,  unit: "lb" },
              { key: "muscle", label: "Lean mass", color: C_MOSS,   unit: "lb" },
              { key: "fat",    label: "Body fat",  color: C_ACCENT, unit: "%" },
            ]}
            goalLines={targetWeightLbs != null ? [{ metricKey: "weight", value: targetWeightLbs, label: `Goal ${targetWeightLbs} lb` }] : []}
          />
        </div>
      )}

      {/* ── Lifts tab ─────────────────────────────────────────── */}
      {tab === "lifts" && (
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 14,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              marginBottom: 14,
            }}
          >
            Estimated 1RM
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {MOCK_LIFT_PRS.map((l) => (
              <div key={l.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 7,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: "var(--color-ink)",
                    }}
                  >
                    {l.name}
                  </span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 22,
                        fontWeight: 400,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {l.val}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>lb ·</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-moss)" }}>
                      {l.delta}
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "var(--color-bg-sunk)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(l.val / 300) * 100}%`,
                      background: "var(--color-ink)",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cardio tab ─────────────────────────────────────────── */}
      {tab === "cardio" && (
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 14,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              marginBottom: 14,
            }}
          >
            Running · Last 7 days
          </div>
          {weeklyRuns === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--color-ink-4)",
                textAlign: "center",
                padding: "16px 0",
              }}
            >
              No runs recorded this week
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBlock
                label="Avg pace"
                value={fmtPace(avgPaceSec)}
                unit="/mi"
              />
              <StatBlock
                label="Weekly miles"
                value={weeklyMiles != null ? weeklyMiles.toFixed(1) : "—"}
                unit="mi"
                delta={`${weeklyRuns} run${weeklyRuns !== 1 ? "s" : ""}`}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Body composition stats (always shown) ────────────── */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          margin: "20px 0 10px",
        }}
      >
        Body composition
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "14px 16px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 5 }}>
            Weight
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em" }}>
              {currentWeight.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>lb</span>
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 4, color: weightDeltaGood ? "var(--color-moss)" : "var(--color-ink-3)" }}>
            {weightDelta}
          </div>
          {targetWeightLbs != null && (() => {
            const diff = currentWeight - targetWeightLbs;
            const reached = diff <= 0;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: "var(--color-ink-4)", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {reached ? "Goal reached 🎉" : `${Math.abs(diff).toFixed(1)} lb to goal`}
                </div>
                <div style={{ height: 4, background: "var(--color-bg-sunk)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: reached ? "var(--color-moss)" : "var(--color-accent)",
                    width: `${Math.min(100, Math.max(0, reached ? 100 : (1 - diff / Math.max(currentWeight - targetWeightLbs + (withingsDelta30d ?? 5), 1)) * 100))}%`,
                    transition: "width 600ms ease",
                  }} />
                </div>
              </div>
            );
          })()}
        </div>

        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "14px 16px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 5 }}>
            Lean mass
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em" }}>
              {MOCK_MUSCLES[4].toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>lb</span>
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 4, color: "var(--color-moss)" }}>
            +{(MOCK_MUSCLES[4] - MOCK_MUSCLES[0]).toFixed(1)} lb · 12 wks
          </div>
        </div>

        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "14px 16px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 5 }}>
            Body fat %
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em" }}>
              {MOCK_FATS[4].toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>%</span>
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 4, color: "var(--color-moss)" }}>
            −{(MOCK_FATS[0] - MOCK_FATS[4]).toFixed(1)} pts · 12 wks
          </div>
        </div>

        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "14px 16px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 5 }}>
            Waist
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em" }}>
              33.5
            </span>
            <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>in</span>
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 4, color: "var(--color-moss)" }}>
            −1.0 in · 12 wks
          </div>
        </div>
      </div>

      {/* ── Activity feed ─────────────────────────────────────── */}
      {feedItems.length > 0 && (() => {
        const groups: { day: string; items: FeedItem[] }[] = [];
        for (const item of feedItems.slice(0, 30)) {
          const day = relativeDay(item.date);
          const last = groups[groups.length - 1];
          if (last && last.day === day) last.items.push(item);
          else groups.push({ day, items: [item] });
        }
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", margin: "20px 0 10px" }}>
              Activity feed
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {groups.map(({ day, items }) => (
                <div key={day}>
                  <div style={{ fontSize: 10, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500, marginBottom: 6 }}>{day}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {items.map((item) => (
                      <div key={item.id} style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-card)" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: item.type === "workout" ? "var(--color-accent-soft)" : "var(--color-bg-sunk)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                          {item.detail && <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1 }}>{item.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
