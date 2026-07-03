"use client";

import { useState, useMemo, useEffect } from "react";
import { Segmented, Icons } from "@/components/ios";
import TrendChart from "./TrendChart";

// ── Chart series hues (iOS tokens) ───────────────────────────────
const C_WEIGHT = "var(--ios-tint)";
const C_LEAN   = "var(--ios-green)";
const C_FAT    = "var(--ios-orange)";

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
  const yesterday = fmt(new Date(new Date().getTime() - 86_400_000));
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

type Tab = "body" | "lifts" | "cardio";

// ── Stat tile ─────────────────────────────────────────────────────
function StatTile({
  label, value, unit, delta, deltaGood, children,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaGood?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="ios-tile">
      <span className="ios-tile-label" style={{ color: "var(--ios-label-2)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span className="ios-num ios-tile-value">{value}</span>
        {unit && <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{unit}</span>}
      </div>
      {delta && (
        <div className="ios-num ios-caption" style={{ marginTop: 2, color: deltaGood ? "var(--ios-green)" : "var(--ios-label-2)" }}>
          {delta}
        </div>
      )}
      {children}
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

  const cardStyle: React.CSSProperties = {
    margin: "0 16px 14px", padding: "16px",
  };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Header */}
      <div style={{ padding: "0 16px 12px" }}>
        <h1 className="ios-large-title">Progress</h1>
        <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>How you&apos;re trending</div>
      </div>

      {/* Streak + monthly workouts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px 14px" }}>
        <div className="ios-tile" style={streak > 0 ? { background: "var(--ios-tint)" } : undefined}>
          <div className="ios-tile-top">
            <span className="ios-tile-label" style={{ color: streak > 0 ? "rgba(255,255,255,0.7)" : "var(--ios-label-2)" }}>Streak</span>
            <Icons.SparkleIcon style={{ color: streak > 0 ? "#fff" : "var(--ios-orange)" }} />
          </div>
          <div className="ios-num" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: streak > 0 ? "#fff" : "var(--ios-label-3)" }}>
            {streak}
          </div>
          <div className="ios-footnote" style={{ marginTop: 3, color: streak > 0 ? "rgba(255,255,255,0.75)" : "var(--ios-label-3)" }}>
            {streak === 1 ? "day" : "days"} in a row
          </div>
        </div>
        <div className="ios-tile">
          <div className="ios-tile-top">
            <span className="ios-tile-label" style={{ color: "var(--ios-label-2)" }}>This month</span>
            <Icons.DumbbellIcon style={{ color: "var(--ios-tint)" }} />
          </div>
          <div className="ios-num" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--ios-label)" }}>
            {monthWorkouts}
          </div>
          <div className="ios-footnote" style={{ marginTop: 3, color: "var(--ios-label-3)" }}>
            workout{monthWorkouts !== 1 ? "s" : ""} logged
          </div>
        </div>
      </div>

      {/* 7-day step trend */}
      {last7Steps.some((d) => d.steps > 0) && (
        <div className="ios-list" style={cardStyle}>
          <div className="ios-group-header" style={{ padding: "0 0 12px" }}>Steps · 7-day trend</div>
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 56 }}>
            {(() => {
              const maxS = Math.max(...last7Steps.map((d) => d.steps), 1);
              return last7Steps.map(({ day, steps: s }) => (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                    <div style={{ width: "100%", height: s > 0 ? `${Math.max((s / maxS) * 100, 8)}%` : 4, background: s > 0 ? "var(--ios-green)" : "var(--ios-fill)", borderRadius: "3px 3px 2px 2px" }} />
                  </div>
                  <span className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 500 }}>{day}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Tab control */}
      <Segmented
        ariaLabel="Progress view"
        value={tab}
        onChange={(v: Tab) => setTab(v)}
        options={[
          { value: "body",   label: "Body"   },
          { value: "lifts",  label: "Lifts"  },
          { value: "cardio", label: "Cardio" },
        ]}
      />

      {/* ── Body tab ─────────────────────────────────────────── */}
      {tab === "body" && (
        <div className="ios-list" style={{ ...cardStyle, marginTop: 14 }}>
          <TrendChart
            data={bodyData}
            height={220}
            metrics={[
              { key: "weight", label: "Weight",    color: C_WEIGHT, unit: "lb" },
              { key: "muscle", label: "Lean mass", color: C_LEAN,   unit: "lb" },
              { key: "fat",    label: "Body fat",  color: C_FAT,    unit: "%" },
            ]}
            goalLines={targetWeightLbs != null ? [{ metricKey: "weight", value: targetWeightLbs, label: `Goal ${targetWeightLbs} lb` }] : []}
          />
        </div>
      )}

      {/* ── Lifts tab ─────────────────────────────────────────── */}
      {tab === "lifts" && (
        <div className="ios-list" style={{ ...cardStyle, marginTop: 14 }}>
          <div className="ios-group-header" style={{ padding: "0 0 14px" }}>Estimated 1RM</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {MOCK_LIFT_PRS.map((l) => (
              <div key={l.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                  <span className="ios-subhead" style={{ fontWeight: 500 }}>{l.name}</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span className="ios-num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{l.val}</span>
                    <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>lb ·</span>
                    <span className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-green)" }}>{l.delta}</span>
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--ios-fill)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(l.val / 300) * 100}%`, background: "var(--ios-tint)", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cardio tab ─────────────────────────────────────────── */}
      {tab === "cardio" && (
        <div className="ios-list" style={{ ...cardStyle, marginTop: 14 }}>
          <div className="ios-group-header" style={{ padding: "0 0 14px" }}>Running · Last 7 days</div>
          {weeklyRuns === 0 ? (
            <div className="ios-subhead" style={{ color: "var(--ios-label-3)", textAlign: "center", padding: "16px 0" }}>
              No runs recorded this week
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <StatTile label="Avg pace" value={fmtPace(avgPaceSec)} unit="/mi" />
              <StatTile
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
      <div className="ios-group-header" style={{ padding: "6px 16px 10px" }}>Body composition</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px 14px" }}>
        <StatTile label="Weight" value={currentWeight.toFixed(1)} unit="lb" delta={weightDelta} deltaGood={weightDeltaGood}>
          {targetWeightLbs != null && (() => {
            const diff = currentWeight - targetWeightLbs;
            const reached = diff <= 0;
            return (
              <div style={{ marginTop: 8 }}>
                <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 4, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                  {reached ? "Goal reached 🎉" : `${Math.abs(diff).toFixed(1)} lb to goal`}
                </div>
                <div style={{ height: 5, background: "var(--ios-fill)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: reached ? "var(--ios-green)" : "var(--ios-tint)",
                    width: `${Math.min(100, Math.max(0, reached ? 100 : (1 - diff / Math.max(currentWeight - targetWeightLbs + (withingsDelta30d ?? 5), 1)) * 100))}%`,
                    transition: "width 600ms ease",
                  }} />
                </div>
              </div>
            );
          })()}
        </StatTile>

        <StatTile
          label="Lean mass"
          value={MOCK_MUSCLES[4].toFixed(1)}
          unit="lb"
          delta={`+${(MOCK_MUSCLES[4] - MOCK_MUSCLES[0]).toFixed(1)} lb · 12 wks`}
          deltaGood
        />
        <StatTile
          label="Body fat %"
          value={MOCK_FATS[4].toFixed(1)}
          unit="%"
          delta={`−${(MOCK_FATS[0] - MOCK_FATS[4]).toFixed(1)} pts · 12 wks`}
          deltaGood
        />
        <StatTile label="Waist" value="33.5" unit="in" delta="−1.0 in · 12 wks" deltaGood />
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
          <div style={{ paddingBottom: 14 }}>
            <div className="ios-group-header" style={{ padding: "6px 16px 10px" }}>Activity feed</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {groups.map(({ day, items }) => (
                <div key={day}>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500, margin: "0 16px 6px" }}>{day}</div>
                  <div className="ios-list" style={{ margin: "0 16px" }}>
                    {items.map((item) => (
                      <div key={item.id} className="ios-cell">
                        <span className="ios-cell-lead">
                          <span className="ios-icon" style={{ background: item.type === "workout" ? "var(--ios-green)" : "var(--ios-orange)", fontSize: 15 }}>
                            {item.icon}
                          </span>
                        </span>
                        <span className="ios-cell-body">
                          <span className="ios-cell-title ios-truncate">{item.label}</span>
                          {item.detail && <span className="ios-cell-sub">{item.detail}</span>}
                        </span>
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
