export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import ChatWidget from "../_components/ChatWidget";
import WorkoutHistoryClient, { type UnifiedWorkout } from "./_components/WorkoutHistoryClient";
import ScheduledWorkoutCard, { type ScheduledWorkout } from "./_components/ScheduledWorkoutCard";
import ResumeWorkoutBanner from "./_components/ResumeWorkoutBanner";

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
  // Dedupe duplicate Apple workout rows (same start + type) — re-exports can
  // create duplicates since apple_health_workouts has no unique index.
  const seenAppleWorkout = new Set<string>();
  const appleWorkouts: UnifiedWorkout[] = (
    (appleRows as {
      id: string;
      timestamp: string;
      workout_type: string;
      duration_sec: number | null;
      distance_m: number | null;
      calories: number | null;
    }[] | null) ?? []
  ).filter((w) => {
    const k = `${w.timestamp}|${w.workout_type}`;
    if (seenAppleWorkout.has(k)) return false;
    seenAppleWorkout.add(k);
    return true;
  }).map((w) => {
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

  // Build workout history context for AI coach (last 7 sessions)
  const recentSessions = allWorkouts.slice(0, 7);
  const workoutHistoryContext = recentSessions.length > 0
    ? `\n\n## Recent workout history (last ${recentSessions.length} sessions)\n` +
      recentSessions.map((w) => {
        const parts = [w.dateStr, w.label];
        if (w.durationLabel) parts.push(w.durationLabel);
        if (w.meta) parts.push(w.meta);
        return `- ${parts.join(" · ")}`;
      }).join("\n") +
      "\n\nUse this history to give specific progressive overload suggestions and reference what they've actually done recently."
    : "";

  const workoutCoachContext = `You are an expert personal trainer and strength coach. Give specific, actionable advice about programming, form, progressive overload, and recovery. Keep answers concise — 2-4 sentences unless the question genuinely requires more. Be encouraging but direct.${workoutHistoryContext}`;

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
    <div className="ios-scroll">
      <LargeTitle title="Train" subtitle="Today's session" />

      {/* Resume an in-progress workout (localStorage snapshot; client widget) */}
      <div style={{ padding: "8px 16px 0" }}>
        <ResumeWorkoutBanner />
      </div>

      {/* Scheduled workouts (client widget) */}
      <div style={{ padding: "8px 16px 0" }}>
        <ScheduledWorkoutCard workouts={scheduledWorkouts} />
      </div>

      <Group header="Start a session">
        {/* Custom workout — build the plan first (muscles, cardio, stretching)
            before ever landing on the tracker; jumps straight to the body-part
            picker, past the "repeat last workout" shortcut */}
        <Cell
          href="/health/workout/builder#body-picker"
          lead={<IconBadge color="var(--ios-tint)"><Icons.DumbbellIcon /></IconBadge>}
          title="Custom workout"
          subtitle="Build a plan — muscles, cardio, stretching"
        />
        <Cell
          href="/health/workout/log"
          lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>}
          title="Quick log"
          subtitle="Log today's workout"
        />
      </Group>

      {/* Workout coach chat — above history */}
      <Group header="Workout coach">
        <div style={{ padding: "14px 16px" }}>
          <ChatWidget
            systemContext={workoutCoachContext}
            placeholder="Ask about sets, reps, form, programming…"
            welcomeMessage="Ready to help with your training. What do you want to work on?"
            addProfileContext
          />
        </div>
      </Group>

      {/* Unified workout history */}
      <Group header="History · Last 30 days">
        <Cell
          href="/health/workout/log?past=1"
          lead={<IconBadge color="#8E8E93"><Icons.PlusIcon /></IconBadge>}
          title="Log past workout"
        />
      </Group>
      <div style={{ padding: "10px 16px 0" }}>
        <WorkoutHistoryClient groups={groups} />
      </div>

    </div>
  );
}
