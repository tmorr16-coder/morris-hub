"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LargeTitle } from "@/components/ios";
import { quickLogWorkout } from "./actions";

const WORKOUT_TYPES = [
  "Strength",
  "Upper Body",
  "Lower Body",
  "Full Body",
  "Push",
  "Pull",
  "Legs",
  "Cardio",
  "Running",
  "Cycling",
  "Yoga",
  "Mobility",
  "HIIT",
  "Swimming",
  "Walking",
  "Other",
];

const DISTANCE_TYPES = new Set(["Cardio", "Running", "Cycling", "Swimming", "Walking"]);

const EFFORT_OPTIONS = [
  { value: "easy",     label: "Easy",     desc: "Comfortable" },
  { value: "moderate", label: "Moderate", desc: "Challenging" },
  { value: "hard",     label: "Hard",     desc: "Very hard" },
  { value: "allout",   label: "All-out",  desc: "Max effort" },
];

const fieldLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  marginBottom: 6,
};

const todayStr = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD in local time

export default function QuickLogPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [type, setType] = useState("");
  const [customType, setCustomType] = useState("");
  const [duration, setDuration] = useState("45");
  const [distance, setDistance] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);

  const workoutLabel = type === "Other" ? customType.trim() : type;
  const showDistance = DISTANCE_TYPES.has(type);
  const valid = workoutLabel.length > 0 && parseInt(duration) > 0;
  const isBackdated = date !== todayStr();

  function handleSave() {
    if (!valid) return;
    setSaving(true);
    startTransition(async () => {
      await quickLogWorkout({
        type: workoutLabel,
        durationMin: parseInt(duration),
        notes: notes.trim() || null,
        date,
        distanceMiles: showDistance && distance ? parseFloat(distance) : null,
        effort: effort || null,
      });
      router.push("/health/train");
    });
  }

  return (
    <div className="ios-scroll" style={{ paddingBottom: 100 }}>

      <LargeTitle
        title={isBackdated ? "Log a past workout" : "Log today's workout"}
        subtitle="Quick log"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 16px 0" }}>

        {/* Date */}
        <div>
          <div style={fieldLabel}>
            Date{isBackdated && <span style={{ color: "var(--color-accent)", marginLeft: 6 }}>· backdated</span>}
          </div>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value || todayStr())}
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: 10,
              border: `1px solid ${isBackdated ? "var(--color-accent)" : "var(--color-line)"}`,
              background: "var(--color-bg-sunk)",
              color: "var(--color-ink)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Workout type chips */}
        <div>
          <div style={fieldLabel}>Workout type</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {WORKOUT_TYPES.map((t) => {
              const selected = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(selected ? "" : t)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-line)"}`,
                    background: selected ? "var(--color-accent-soft)" : "var(--color-bg-raised)",
                    color: selected ? "var(--color-accent)" : "var(--color-ink-3)",
                    fontSize: 13,
                    fontWeight: selected ? 600 : 400,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 120ms",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {type === "Other" && (
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="e.g. Rock climbing"
              style={{
                marginTop: 10,
                width: "100%",
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-bg-sunk)",
                color: "var(--color-ink)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {/* Duration */}
        <div>
          <div style={fieldLabel}>Duration (minutes)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setDuration((d) => String(Math.max(5, parseInt(d) - 5)))}
              style={{
                width: 44, height: 44, borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-bg-raised)",
                color: "var(--color-ink)", fontSize: 18, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              −
            </button>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              type="number"
              min="1"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-bg-sunk)",
                color: "var(--color-ink)",
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                textAlign: "center",
                outline: "none",
              }}
            />
            <button
              onClick={() => setDuration((d) => String(parseInt(d) + 5))}
              style={{
                width: 44, height: 44, borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-bg-raised)",
                color: "var(--color-ink)", fontSize: 18, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              +
            </button>
          </div>
          {/* Quick duration presets */}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[30, 45, 60, 75, 90].map((m) => (
              <button
                key={m}
                onClick={() => setDuration(String(m))}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: `1px solid ${duration === String(m) ? "var(--color-accent)" : "var(--color-line)"}`,
                  background: duration === String(m) ? "var(--color-accent-soft)" : "var(--color-bg-raised)",
                  color: duration === String(m) ? "var(--color-accent)" : "var(--color-ink-3)",
                  fontSize: 12,
                  fontWeight: duration === String(m) ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 120ms",
                }}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* Distance — cardio types only */}
        {showDistance && (
          <div>
            <div style={fieldLabel}>Distance (miles) — optional</div>
            <input
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 3.1"
              inputMode="decimal"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-bg-sunk)",
                color: "var(--color-ink)",
                fontSize: 16,
                fontFamily: "var(--font-mono)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Effort level */}
        <div>
          <div style={fieldLabel}>Effort level — optional</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {EFFORT_OPTIONS.map((e) => {
              const selected = effort === e.value;
              return (
                <button
                  key={e.value}
                  onClick={() => setEffort(selected ? "" : e.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-line)"}`,
                    background: selected ? "var(--color-accent-soft)" : "var(--color-bg-raised)",
                    color: selected ? "var(--color-accent)" : "var(--color-ink-2)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all 120ms",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: selected ? 600 : 500 }}>{e.label}</div>
                  <div style={{ fontSize: 10, color: selected ? "var(--color-accent)" : "var(--color-ink-4)", marginTop: 2 }}>{e.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={fieldLabel}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel? Any PRs?"
            rows={3}
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid var(--color-line)",
              background: "var(--color-bg-sunk)",
              color: "var(--color-ink)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              resize: "none",
              lineHeight: 1.5,
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          disabled={!valid || saving}
          onClick={handleSave}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: valid && !saving ? "var(--color-ink)" : "var(--color-bg-sunk)",
            color: valid && !saving ? "var(--color-bg)" : "var(--color-ink-3)",
            fontSize: 15,
            fontWeight: 600,
            cursor: valid && !saving ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "background 120ms",
          }}
        >
          {saving ? "Saving…" : "Log workout"}
        </button>

      </div>
    </div>
  );
}
