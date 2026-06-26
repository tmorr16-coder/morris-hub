"use client";

import { useTransition } from "react";
import type { Exercise, SetLog } from "../exercise-library";

interface Props {
  exercises: Exercise[];
  setLogs: (SetLog | null)[][];
  sessionElapsed: number;
  onDone: () => void;
}

const eyebrow: React.CSSProperties = {
  fontSize: 9, fontWeight: 500, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6,
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--color-ink)",
        padding: "20px 16px 32px",
        maxWidth: 540,
        margin: "0 auto",
      }}
    >

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--color-ink)",
          borderRadius: 16,
          padding: "24px 20px",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ ...eyebrow, color: "rgba(244,241,236,0.5)", marginBottom: 8 }}>
          Workout complete
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "var(--color-bg)",
            marginBottom: 6,
          }}
        >
          Lower Body Power
        </div>
        <div style={{ fontSize: 14, color: "rgba(244,241,236,0.6)", marginBottom: prCount > 0 ? 6 : 0 }}>
          {formatTime(sessionElapsed)}
        </div>
        {prCount > 0 && (
          <div style={{ fontSize: 13, color: "var(--color-moss)", fontWeight: 600 }}>
            {prCount} PR{prCount > 1 ? "s" : ""} today 🎉
          </div>
        )}
        {volDeltaPct !== null && (
          <div style={{ fontSize: 12, color: parseFloat(volDeltaPct) >= 0 ? "var(--color-moss)" : "var(--color-accent)", marginTop: 4 }}>
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
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              padding: "14px 14px",
            }}
          >
            <div style={eyebrow}>{label}</div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 400,
                color: "var(--color-ink)",
                lineHeight: 1,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 2 }}>{unit}</div>
          </div>
        ))}
      </div>

      {/* ── Exercise breakdown ──────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
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
                background: "var(--color-bg-sunk)",
                borderRadius: 10,
                padding: "12px 14px",
                border: `1px solid ${ex.isPR ? "var(--color-moss)" : "var(--color-line)"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                    {ex.name}
                    {ex.isPR && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-moss)", fontWeight: 700 }}>PR</span>
                    )}
                  </div>
                  {ex.topSet && (
                    <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 1, fontFamily: "var(--font-mono)" }}>
                      Top: {ex.topSet.weight}lb × {ex.topSet.reps}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: ex.isPR ? "var(--color-moss)" : "var(--color-ink)" }}>
                    {ex.thisVol > 0 ? ex.thisVol.toLocaleString() : "—"}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--color-ink-4)" }}>lbs vol</div>
                </div>
              </div>
              {/* Volume bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Last",  vol: ex.lastVol,  color: "var(--color-ink-4)" },
                  { label: "Today", vol: ex.thisVol,  color: ex.isPR ? "var(--color-moss)" : "var(--color-slate)" },
                ].map(({ label, vol, color }) => (
                  <div key={label} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10 }}>
                    <span style={{ color: "var(--color-ink-4)", width: 32, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 4, background: "var(--color-line)", borderRadius: 2, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(vol / Math.max(ex.thisVol, ex.lastVol, 1)) * 100}%`,
                          height: "100%",
                          background: color,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)", width: 36, textAlign: "right", flexShrink: 0 }}>
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
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          padding: "16px",
          marginBottom: 20,
        }}
      >
        <div style={eyebrow}>Recovery</div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 12, lineHeight: 1.5 }}>
          You just stressed {muscleGroups.slice(0, 4).join(", ")}. Prioritize the items below in the next 24h.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "🥩", label: "Protein",  val: "165g today",  note: "~40g in next 90 min", priority: true  },
            { icon: "💧", label: "Hydrate",  val: "+24oz",        note: "Within 1hr post"                     },
            { icon: "🔥", label: "Sauna",    val: "25 min",       note: "Tonight or tomorrow"                  },
            { icon: "😴", label: "Sleep",    val: "8+ hours",     note: "Critical for recovery"                },
          ].map((r) => (
            <div
              key={r.label}
              style={{
                background: "var(--color-bg-sunk)",
                borderRadius: 10,
                padding: "12px",
                border: r.priority ? "1px solid var(--color-accent)" : "1px solid var(--color-line)",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{r.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)", marginBottom: 1 }}>{r.val}</div>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)", lineHeight: 1.4 }}>{r.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Done button ────────────────────────────────────────────────────── */}
      <button
        onClick={() => startTransition(() => { onDone(); })}
        disabled={isPending}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: 12,
          border: "none",
          background: isPending ? "var(--color-bg-sunk)" : "var(--color-ink)",
          color: isPending ? "var(--color-ink-3)" : "var(--color-bg)",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: 700,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? "Saving…" : "Save & go home"}
      </button>

    </div>
  );
}
