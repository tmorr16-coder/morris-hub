"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { deleteWorkoutSession } from "../../workout/log/actions";

export interface UnifiedWorkout {
  id: string;
  dateStr: string;
  label: string;
  durationLabel: string | null;
  source: "manual" | "apple";
  meta: string | null;
}

interface Props {
  groups: { day: string; items: UnifiedWorkout[] }[];
}

function workoutIcon(label: string, source: "manual" | "apple"): string {
  const l = label.toLowerCase();
  if (l.includes("run")) return "🏃";
  if (l.includes("cycl") || l.includes("bike") || l.includes("ride")) return "🚴";
  if (l.includes("walk")) return "🚶";
  if (l.includes("swim")) return "🏊";
  if (l.includes("yoga") || l.includes("stretch")) return "🧘";
  if (l.includes("hike")) return "🥾";
  if (source === "apple") return "🍎";
  return "🏋️";
}

export default function WorkoutHistoryClient({ groups: initialGroups }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      await deleteWorkoutSession(id);
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, items: g.items.filter((w) => w.id !== id) }))
          .filter((g) => g.items.length > 0)
      );
      setDeleting(null);
    });
  }

  if (groups.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          padding: "24px 16px",
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>
          No workouts in the last 30 days.
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-4)", marginTop: 4 }}>
          Log one above or sync from Apple Health.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
      {groups.map(({ day, items }) => (
        <div key={day}>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-ink-4)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            {day}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((w) => (
              <Link
                key={w.id}
                href={`/health/train/${w.id}?source=${w.source}`}
                style={{
                  background: "var(--color-bg-raised)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: deleting === w.id ? 0.4 : 1,
                  transition: "opacity 150ms",
                  textDecoration: "none",
                }}
              >
                {/* Source badge */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: w.source === "manual"
                      ? "var(--color-accent-soft)"
                      : "var(--color-bg-sunk)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                  title={w.source === "manual" ? "Logged in-app" : "From Apple Health"}
                >
                  {workoutIcon(w.label, w.source)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--color-ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {w.label}
                  </div>
                  {(w.durationLabel || w.meta) && (
                    <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2 }}>
                      {[w.durationLabel, w.meta].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>

                <span style={{ fontSize: 16, color: "var(--color-ink-4)", flexShrink: 0 }}>›</span>

                {w.source === "manual" && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(w.id); }}
                    disabled={deleting === w.id}
                    title="Delete workout"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: "1px solid var(--color-line)",
                      background: "var(--color-bg-sunk)",
                      color: "var(--color-ink-4)",
                      fontSize: 14,
                      cursor: deleting === w.id ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontFamily: "inherit",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
