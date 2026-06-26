export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { EXERCISE_LIBRARY } from "../workout/exercise-library";
import Body, { type MuscleGroup } from "../_components/Body";
import ChatWidget from "../_components/ChatWidget";
import WorkoutHistoryClient, { type UnifiedWorkout } from "./_components/WorkoutHistoryClient";
import ScheduledWorkoutCard, { type ScheduledWorkout } from "./_components/ScheduledWorkoutCard";

const PRIMARY_MUSCLES: MuscleGroup[] = ["quads", "glutes", "hamstrings"];
const SECONDARY_MUSCLES: MuscleGroup[] = ["calves"];

function toDateStr(d: Date): string {
  return d.toLocaleDateString("sv");
}

function fmtDayLabel(dateStr: string): string {
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtWorkoutType(raw: string): string {
  return raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default async function TrainPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayShort = new Date().toLocaleDateString("en-US", { weekday: "short" });

  const today = toDateStr(new Date());

  const [{ data: sessionRows }, { data: appleRows }, scheduledResult] = await Promise.all([
    db.from("workout_sessions")
      .select("id, date, type, duration_min")
      .eq("user_id", userId)
      .gte("date", toDateStr(thirtyDaysAgo))
      .order("date", { ascending: false })
      .limit(30),
    db.from("apple_health_workouts")
      .select("id, timestamp, workout_type, duration_sec, distance_m, calories")
      .eq("user_id", userId)
      .gte("timestamp", thirtyDaysAgo.toISOString())
      .order("timestamp", { ascending: false })
      .limit(30),
    db.from("scheduled_workouts")
      .select("id, label, scheduled_date, scheduled_time, plan_encoded, reminder_min")
      .eq("user_id", userId)
      .eq("completed", false)
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(10)
      .then((r: { data: unknown; error: unknown }) => r)
      .catch(() => ({ data: null })),
  ]);

  type SchedRow = { id: string; label: string; scheduled_date: string; scheduled_time: string; plan_encoded: string | null; reminder_min: number };
  const scheduledWorkouts: ScheduledWorkout[] = ((scheduledResult as { data: SchedRow[] | null }).data ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    scheduledDate: r.scheduled_date,
    scheduledTime: r.scheduled_time,
    planEncoded: r.plan_encoded,
    reminderMin: r.reminder_min,
  }));

  // Normalise manual sessions
  const manualWorkouts: UnifiedWorkout[] = (
    (sessionRows as { id: string; date: string; type: string; duration_min: number | null }[] | null) ?? []
  ).map((s) => ({
    id: s.id,
    dateStr: s.date,
    label: s.type,
    durationLabel: s.duration_min !== null ? `${s.duration_min} min` : null,
    source: "manual" as const,
    meta: null,
  }));

  // Normalise Apple Health workouts
  const appleWorkouts: UnifiedWorkout[] = (
    (appleRows as {
      id: string;
      timestamp: string;
      workout_type: string;
      duration_sec: number | null;
      distance_m: number | null;
      calories: number | null;
    }[] | null) ?? []
  ).map((w) => {
    const distMi = w.distance_m ? `${(w.distance_m / 1609.344).toFixed(2)} mi` : null;
    const cal = w.calories ? `${Math.round(w.calories)} kcal` : null;
    const meta = [distMi, cal].filter(Boolean).join(" · ") || null;
    return {
      id: w.id,
      dateStr: toDateStr(new Date(w.timestamp)),
      label: fmtWorkoutType(w.workout_type),
      durationLabel: w.duration_sec !== null ? `${Math.round(w.duration_sec / 60)} min` : null,
      source: "apple" as const,
      meta,
    };
  });

  // Deduplicate: if the same day has a manual session and an Apple Health workout with the same
  // type (case-insensitive), keep only the manual one (it has sets/reps detail).
  const manualKeys = new Set(manualWorkouts.map((m) => `${m.dateStr}:${m.label.toLowerCase()}`));
  const filteredApple = appleWorkouts.filter(
    (a) => !manualKeys.has(`${a.dateStr}:${a.label.toLowerCase()}`)
  );

  const allWorkouts = [...manualWorkouts, ...filteredApple].sort(
    (a, b) => b.dateStr.localeCompare(a.dateStr)
  );

  // Group by day label for display
  const groups: { day: string; items: UnifiedWorkout[] }[] = [];
  for (const w of allWorkouts) {
    const day = fmtDayLabel(w.dateStr);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(w);
    } else {
      groups.push({ day, items: [w] });
    }
  }

  return (
    <div style={{ padding: "20px 20px 0" }}>

      {/* Page header */}
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
        Train
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
        Today&apos;s session.
      </div>

      {/* Scheduled workouts */}
      <ScheduledWorkoutCard workouts={scheduledWorkouts} />

      {/* Hero tile */}
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div style={{ padding: "16px 18px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--color-accent-soft)",
                color: "var(--color-accent)",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Up next · 45–55 min
            </span>
            <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
              Today, {todayShort}
            </span>
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--color-ink)",
              marginBottom: 14,
            }}
          >
            Lower Body Power
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0, paddingTop: 4 }}>
              <Body primary={PRIMARY_MUSCLES} secondary={SECONDARY_MUSCLES} view="front" size={96} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              {EXERCISE_LIBRARY.map((ex, i) => (
                <div
                  key={ex.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    background: "var(--color-bg-sunk)",
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      color: "var(--color-ink-4)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--color-ink)",
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {ex.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--color-ink-3)",
                      flexShrink: 0,
                    }}
                  >
                    {ex.target.sets}×{ex.target.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link
          href="/health/workout"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "14px 18px",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ▸ Start Workout
        </Link>
      </div>

      {/* Custom workout — same visual weight as Start Workout */}
      <Link
        href="/health/workout/builder"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "14px 18px",
          background: "var(--color-accent)",
          color: "#fff",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 14,
          marginBottom: 10,
        }}
      >
        + Custom Workout
      </Link>

      {/* Quick log */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 20 }}>
        <Link href="/health/workout/log" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--color-bg-sunk)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 1 }}>
                Quick log
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
                Log today&apos;s workout
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Workout coach chat — above history */}
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          padding: "16px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 12,
          }}
        >
          Workout coach
        </div>
        <ChatWidget
          systemContext="You are an expert personal trainer and strength coach. Give specific, actionable advice about programming, form, progressive overload, and recovery. Keep answers concise — 2-4 sentences unless the question genuinely requires more. Be encouraging but direct."
          placeholder="Ask about sets, reps, form, programming…"
          welcomeMessage="Ready to help with your training. What do you want to work on?"
          addProfileContext
        />
      </div>

      {/* Unified workout history */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 10,
          }}
        >
          History · Last 30 days
        </div>
        <WorkoutHistoryClient groups={groups} />
      </div>

    </div>
  );
}
