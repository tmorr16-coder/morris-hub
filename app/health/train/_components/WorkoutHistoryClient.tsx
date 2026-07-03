"use client";

import { useTransition, useState, type ReactNode } from "react";
import { Group, Cell, IconBadge } from "@/components/ios";
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

function RunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="15" cy="4" r="1.7" />
      <path d="M10 8l3.5 2 2 3M13 10l-3 4-4 1M15.5 13l1 5M10 12l-2 5" />
    </svg>
  );
}
function BikeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="17" r="3.2" />
      <circle cx="18.5" cy="17" r="3.2" />
      <path d="M5.5 17l4-7h5l-3 7M9 6h3" />
    </svg>
  );
}
function WalkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="1.7" />
      <path d="M12 8l-2 4 3 2 1 6M10 12l-3 2-1 4M13 10l3 1" />
    </svg>
  );
}
function SwimIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="16" cy="7" r="1.7" />
      <path d="M5 10l4-2 4 3 3-1M3 16c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0M3 20c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0" />
    </svg>
  );
}
function YogaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4" r="1.7" />
      <path d="M12 7v6M5 11h14M8 20l4-7 4 7" />
    </svg>
  );
}
function DumbbellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8v8M4 6v12M18 8v8M20 6v12M6 12h12" />
    </svg>
  );
}

function workoutIcon(label: string, source: "manual" | "apple"): ReactNode {
  const l = label.toLowerCase();
  if (l.includes("run")) return <RunIcon />;
  if (l.includes("cycl") || l.includes("bike") || l.includes("ride")) return <BikeIcon />;
  if (l.includes("walk") || l.includes("hike")) return <WalkIcon />;
  if (l.includes("swim")) return <SwimIcon />;
  if (l.includes("yoga") || l.includes("stretch")) return <YogaIcon />;
  void source;
  return <DumbbellIcon />;
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
      <Group>
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "center", gap: 4, padding: "24px 16px", textAlign: "center" }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>
            No workouts in the last 30 days.
          </div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>
            Log one above or sync from Apple Health.
          </div>
        </div>
      </Group>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {groups.map(({ day, items }) => (
        <Group key={day} header={day}>
          {items.map((w) => (
            <Cell
              key={w.id}
              href={`/health/train/${w.id}?source=${w.source}`}
              lead={
                <IconBadge color={w.source === "manual" ? "var(--ios-tint)" : "var(--ios-label-3)"}>
                  {workoutIcon(w.label, w.source)}
                </IconBadge>
              }
              title={w.label}
              subtitle={
                (w.durationLabel || w.meta)
                  ? [w.durationLabel, w.meta].filter(Boolean).join(" · ")
                  : undefined
              }
              trailing={
                w.source === "manual" ? (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(w.id); }}
                    disabled={deleting === w.id}
                    title="Delete workout"
                    aria-label="Delete workout"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "none",
                      background: "var(--ios-fill)",
                      color: "var(--ios-label-2)",
                      cursor: deleting === w.id ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                ) : undefined
              }
            />
          ))}
        </Group>
      ))}
    </div>
  );
}
