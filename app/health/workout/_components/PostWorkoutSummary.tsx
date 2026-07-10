"use client";

import { useTransition, type ReactNode } from "react";
import type { Exercise, SetLog } from "../exercise-library";

interface Props {
  exercises: Exercise[];
  setLogs: (SetLog | null)[][];
  sessionElapsed: number;
  onDone: () => void;
}

const eyebrow: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "var(--ios-label-2)", marginBottom: 8,
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ProteinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 15c-2-2-2-6 1-8s7-2 9 0 2 6 0 8-6 3-8 1M8 12l2 2M11 9l2 2" />
    </svg>
  );
}
function DropletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10Z" />
    </svg>
  );
}
function FlameIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c2 2 3 4 3 6a5 5 0 0 1-10 0c0-4 3-6 5-13Z" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14a8 8 0 1 1-9-11 6 6 0 0 0 9 8Z" />
    </svg>
  );
}

export default function PostWorkoutSummary({ exercises, setLogs, sessionElapsed, onDone }: Props) {
  const [isPending, startTransition] = useTransition();

  const allSets     = setLogs.flat().filter((s): s is SetLog => s !== null);
  const totalVolume = allSets.reduce((sum, s) => sum + s.reps * s.weight, 0);
  const totalReps   = allSets.reduce((sum, s) => sum + s.reps, 0);
  const avgRpe      = allSets.length > 0
    ? (allSets.reduce((sum, s) => sum + s.rpe, 0) / allSets.length).toFixed(1)
    : "0";
  const estCalories = Math.round((sessionElapsed / 60) * 6.5);

  const breakdown = exercises.map((ex, i) => {
    const thisSets = (setLogs[i] ?? []).filter((s): s is SetLog => s !== null);
    const thisVol  = thisSets.reduce((sum, s) => sum + s.reps * s.weight, 0);
    const lastVol  = ex.lastSession.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
    const isPR     = thisVol > lastVol && thisSets.length > 0;
    const topSet   = thisSets.reduce<SetLog | null>(
      (best, s) => (!best || s.weight * s.reps > best.weight * best.reps ? s : best),
      null
    );
    return { name: ex.name, thisVol, lastVol, delta: thisVol - lastVol, isPR, topSet, muscles: ex.muscles };
  });

  const prCount = breakdown.filter((e) => e.isPR).length;
  const lastTotalVol = exercises.reduce(
    (sum, ex) => sum + ex.lastSession.sets.reduce((s2, s) => s2 + s.reps * s.weight, 0),
    0
  );
  const volDeltaPct = lastTotalVol > 0
    ? ((totalVolume - lastTotalVol) / lastTotalVol * 100).toFixed(1)
    : null;

  const muscleGroups = [...new Set(exercises.flatMap((ex) => ex.muscles))];

  const recovery: { Icon: () => ReactNode; label: string; val: string; note: string; priority?: boolean }[] = [
    { Icon: ProteinIcon, label: "Protein",  val: "165g today",  note: "~40g in next 90 min", priority: true },
    { Icon: DropletIcon, label: "Hydrate",  val: "+24oz",       note: "Within 1hr post" },
    { Icon: FlameIcon,   label: "Sauna",    val: "25 min",      note: "Tonight or tomorrow" },
    { Icon: MoonIcon,    label: "Sleep",    val: "8+ hours",    note: "Critical for recovery" },
  ];

  return (
    <div
      style={{
        color: "var(--ios-label)",
        padding: "20px 16px 32px",
        maxWidth: 540,
        margin: "0 auto",
      }}
    >

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--ios-tint)",
          borderRadius: "var(--ios-radius-tile)",
          padding: "24px 20px",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
          Workout complete
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: "#fff",
            marginBottom: 6,
          }}
        >
          Lower Body Power
        </div>
        <div className="ios-num" style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: prCount > 0 ? 6 : 0 }}>
          {formatTime(sessionElapsed)}
        </div>
        {prCount > 0 && (
          <div className="ios-subhead" style={{ color: "#fff", fontWeight: 600 }}>
            {prCount} PR{prCount > 1 ? "s" : ""} today
          </div>
        )}
        {volDeltaPct !== null && (
          <div className="ios-num" style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
            {parseFloat(volDeltaPct) >= 0 ? "↑" : "↓"}{Math.abs(parseFloat(volDeltaPct))}% volume vs last session
          </div>
        )}
      </div>

      {/* ── Stats 2×2 ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Volume",   value: totalVolume.toLocaleString(), unit: "lbs"  },
          { label: "Reps",     value: totalReps,                    unit: "total" },
          { label: "Avg RPE",  value: avgRpe,                       unit: "/ 10" },
          { label: "Calories", value: estCalories,                  unit: "kcal" },
        ].map(({ label, value, unit }) => (
          <div
            key={label}
            style={{
              background: "var(--ios-cell)",
              borderRadius: "var(--ios-radius-card)",
              padding: "14px 14px",
            }}
          >
            <div style={eyebrow}>{label}</div>
            <div
              className="ios-num"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--ios-label)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {value}
            </div>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 3 }}>{unit}</div>
          </div>
        ))}
      </div>

      {/* ── Exercise breakdown ──────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "16px",
          marginBottom: 14,
        }}
      >
        <div style={eyebrow}>Breakdown</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {breakdown.map((ex) => (
            <div
              key={ex.name}
              style={{
                background: "var(--ios-bg)",
                borderRadius: 10,
                padding: "12px 14px",
                border: `1px solid ${ex.isPR ? "var(--ios-green)" : "transparent"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                    {ex.name}
                    {ex.isPR && (
                      <span className="ios-caption" style={{ marginLeft: 6, color: "var(--ios-green)", fontWeight: 700 }}>PR</span>
                    )}
                  </div>
                  {ex.topSet && (
                    <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", marginTop: 1 }}>
                      Top: {ex.topSet.weight}lb × {ex.topSet.reps}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="ios-num" style={{ fontSize: 16, fontWeight: 700, color: ex.isPR ? "var(--ios-green)" : "var(--ios-label)" }}>
                    {ex.thisVol > 0 ? ex.thisVol.toLocaleString() : "—"}
                  </div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>lbs vol</div>
                </div>
              </div>
              {/* Volume bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Last",  vol: ex.lastVol,  color: "var(--ios-label-3)" },
                  { label: "Today", vol: ex.thisVol,  color: ex.isPR ? "var(--ios-green)" : "var(--ios-tint)" },
                ].map(({ label, vol, color }) => (
                  <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="ios-caption" style={{ color: "var(--ios-label-3)", width: 32, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 5, background: "var(--ios-fill)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(vol / Math.max(ex.thisVol, ex.lastVol, 1)) * 100}%`,
                          height: "100%",
                          background: color,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span className="ios-caption ios-num" style={{ color: "var(--ios-label-2)", width: 36, textAlign: "right", flexShrink: 0 }}>
                      {vol || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recovery ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "16px",
          marginBottom: 20,
        }}
      >
        <div style={eyebrow}>Recovery</div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 12, lineHeight: 1.5 }}>
          You just stressed {muscleGroups.slice(0, 4).join(", ")}. Prioritize the items below in the next 24h.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {recovery.map((r) => (
            <div
              key={r.label}
              style={{
                background: "var(--ios-bg)",
                borderRadius: 10,
                padding: "12px",
                border: r.priority ? "1px solid var(--ios-tint)" : "1px solid transparent",
              }}
            >
              <div style={{ display: "flex", color: "var(--ios-tint)", marginBottom: 6 }}><r.Icon /></div>
              <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 1 }}>{r.val}</div>
              <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>{r.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Done button ────────────────────────────────────────────────────── */}
      <button
        onClick={() => startTransition(() => { onDone(); })}
        disabled={isPending}
        className="ios-btn ios-btn--full"
        style={{
          background: isPending ? "var(--ios-fill)" : "var(--ios-tint)",
          color: isPending ? "var(--ios-label-3)" : "#fff",
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? "Saving…" : "Save & go home"}
      </button>

    </div>
  );
}
