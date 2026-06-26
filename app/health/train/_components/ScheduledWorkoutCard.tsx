"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteScheduledWorkout } from "../../workout/actions";

export interface ScheduledWorkout {
  id: string;
  label: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM:SS
  planEncoded: string | null;
  reminderMin: number;
}

function fmtDate(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  const today = new Date();
  const isToday = dt.toLocaleDateString("sv") === today.toLocaleDateString("sv");
  const isTomorrow =
    dt.toLocaleDateString("sv") ===
    new Date(Date.now() + 86_400_000).toLocaleDateString("sv");
  const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeFmt = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dayLabel} · ${timeFmt}`;
}

function minutesUntil(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  return Math.round((dt.getTime() - Date.now()) / 60_000);
}

interface Props {
  workouts: ScheduledWorkout[];
}

export default function ScheduledWorkoutCard({ workouts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const notifiedIds = useRef(new Set<string>());

  // Request notification permission and schedule browser notifications
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const w of workouts) {
      const minsUntilWorkout = minutesUntil(w.scheduledDate, w.scheduledTime);
      const minsUntilReminder = minsUntilWorkout - w.reminderMin;

      const fire = (msg: string, id: string) => {
        if (notifiedIds.current.has(id)) return;
        notifiedIds.current.add(id);
        new Notification("Workout reminder", { body: msg, icon: "/favicon.ico" });
      };

      if (minsUntilReminder > 0 && minsUntilReminder < 24 * 60) {
        timers.push(setTimeout(() => fire(`${w.label} starts in ${w.reminderMin} min`, `${w.id}-early`), minsUntilReminder * 60_000));
      } else if (minsUntilReminder <= 0 && minsUntilWorkout > -5) {
        // Reminder time already passed but workout not yet — fire now if not fired
        fire(`${w.label} starts in ${Math.max(0, minsUntilWorkout)} min`, `${w.id}-early`);
      }

      if (minsUntilWorkout > 0 && minsUntilWorkout < 24 * 60) {
        timers.push(setTimeout(() => fire(`Time to work out: ${w.label}`, `${w.id}-start`), minsUntilWorkout * 60_000));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [workouts]);

  if (workouts.length === 0) return null;

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteScheduledWorkout(id);
      router.refresh();
    });
  };

  const handleStart = (w: ScheduledWorkout) => {
    const url = w.planEncoded
      ? `/health/workout?plan=${encodeURIComponent(w.planEncoded)}`
      : "/health/workout";
    router.push(url);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
        Scheduled
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {workouts.map((w) => {
          const mins = minutesUntil(w.scheduledDate, w.scheduledTime);
          const isDue = mins <= w.reminderMin && mins > -60;
          return (
            <div
              key={w.id}
              style={{
                background: "var(--color-bg-raised)",
                border: `1px solid ${isDue ? "var(--color-moss)" : "var(--color-line)"}`,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: isDue ? "var(--color-moss-soft)" : "var(--color-bg-sunk)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {isDue ? "🏃" : "📅"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isDue && (
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-moss)", marginBottom: 2 }}>
                        Starting soon
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
                      {fmtDate(w.scheduledDate, w.scheduledTime)}
                      {isDue && mins > 0 && <span style={{ color: "var(--color-moss)", fontWeight: 500, marginLeft: 6 }}>· in {mins} min</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(w.id)}
                    style={{ background: "none", border: "none", color: "var(--color-ink-4)", fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                    aria-label="Delete scheduled workout"
                  >
                    ×
                  </button>
                </div>
              </div>
              {isDue && (
                <button
                  onClick={() => handleStart(w)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 16px", background: "var(--color-moss)", color: "#fff", border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  ▸ Start now
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
