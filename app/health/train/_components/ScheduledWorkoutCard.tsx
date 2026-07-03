"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconBadge, Icons } from "@/components/ios";
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
    new Date(new Date().getTime() + 86_400_000).toLocaleDateString("sv");
  const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeFmt = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dayLabel} · ${timeFmt}`;
}

function minutesUntil(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  return Math.round((dt.getTime() - new Date().getTime()) / 60_000);
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
    <section style={{ marginBottom: 16 }}>
      <h2 className="ios-group-header" style={{ padding: "0 0 7px" }}>Scheduled</h2>
      <div className="ios-list" style={{ margin: 0 }}>
        {workouts.map((w) => {
          const mins = minutesUntil(w.scheduledDate, w.scheduledTime);
          const isDue = mins <= w.reminderMin && mins > -60;
          return (
            <div key={w.id}>
              <div className="ios-cell">
                <span className="ios-cell-lead">
                  <IconBadge color={isDue ? "var(--ios-green)" : "var(--ios-tint)"}>
                    {isDue ? <Icons.DumbbellIcon /> : <Icons.CalendarIcon />}
                  </IconBadge>
                </span>
                <span className="ios-cell-body">
                  {isDue && (
                    <span className="ios-caption" style={{ color: "var(--ios-green)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Starting soon
                    </span>
                  )}
                  <span className="ios-cell-title ios-truncate">{w.label}</span>
                  <span className="ios-cell-sub">
                    {fmtDate(w.scheduledDate, w.scheduledTime)}
                    {isDue && mins > 0 && <span style={{ color: "var(--ios-green)", fontWeight: 500 }}> · in {mins} min</span>}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(w.id)}
                  aria-label="Delete scheduled workout"
                  style={{ flexShrink: 0, color: "var(--ios-label-3)", display: "flex", padding: 4 }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              {isDue && (
                <button
                  type="button"
                  onClick={() => handleStart(w)}
                  className="ios-cell"
                  style={{ color: "var(--ios-green)", fontWeight: 600, justifyContent: "center", gap: 6 }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                  Start now
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
