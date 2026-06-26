export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { createClient } from "@/lib/supabase/server";
import ProgressClient from "./_components/ProgressClient";

function toDateStr(d: Date) { return d.toLocaleDateString("sv"); }

export default async function ProgressPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const [userId, supabase] = await Promise.all([getCurrentUserId(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const serverTargetWeightLbs: number | null =
    typeof meta.target_weight_lbs === "number" ? meta.target_weight_lbs : null;

  const sevenDaysAgo  = new Date(Date.now() - 7  * 86_400_000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [
    { data: latestWeightRows },
    { data: oldestWeightRows },
    { data: runRows },
    { data: sessionRows },
    { data: mealRows },
    { data: stepRows },
  ] = await Promise.all([
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId).eq("source", "withings").eq("metric_name", "weight")
      .order("timestamp", { ascending: false }).limit(1),
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId).eq("source", "withings").eq("metric_name", "weight")
      .gte("timestamp", thirtyDaysAgo.toISOString())
      .order("timestamp", { ascending: true }).limit(1),
    db.from("apple_health_workouts")
      .select("duration_sec, distance_m")
      .eq("user_id", userId)
      .in("workout_type", ["Running", "OutdoorRun", "IndoorRun", "TrackRun"])
      .gte("timestamp", sevenDaysAgo.toISOString()),
    // For streak + feed
    db.from("workout_sessions")
      .select("id, date, type, duration_min, effort")
      .eq("user_id", userId)
      .gte("date", toDateStr(thirtyDaysAgo))
      .order("date", { ascending: false }).limit(50),
    db.from("meals")
      .select("id, date, meal_type, name, calories_est")
      .eq("user_id", userId)
      .gte("date", toDateStr(thirtyDaysAgo))
      .order("date", { ascending: false }).limit(60),
    // 7-day steps — apple_health only to avoid double-counting
    db.from("apple_health_metrics")
      .select("value, timestamp")
      .eq("user_id", userId).eq("source", "apple_health")
      .in("metric_name", ["step_count", "Step Count", "Steps"])
      .gte("timestamp", sevenDaysAgo.toISOString()),
  ]);

  type WtRow  = { value: number };
  type RunRow = { duration_sec: number | null; distance_m: number | null };
  type WkRow  = { id: string; date: string; type: string; duration_min: number | null; effort: string | null };
  type MRow   = { id: string; date: string; meal_type: string; name: string; calories_est: number | null };
  type StRow  = { value: number; timestamp: string };

  const withingsCurrent: number | null = (latestWeightRows as WtRow[]|null)?.[0]?.value ?? null;
  const withingsOldest:  number | null = (oldestWeightRows as WtRow[]|null)?.[0]?.value ?? null;
  const withingsDelta30d: number | null =
    withingsCurrent !== null && withingsOldest !== null
      ? parseFloat((withingsCurrent - withingsOldest).toFixed(1))
      : null;

  const runs: RunRow[] = (runRows as RunRow[]|null) ?? [];
  const weeklyMiles: number | null = runs.length
    ? parseFloat(runs.reduce((s, r) => s + (r.distance_m ?? 0) / 1609.344, 0).toFixed(2))
    : null;
  const totalDurSec = runs.reduce((s, r) => s + (r.duration_sec ?? 0), 0);
  const avgPaceSec: number | null = weeklyMiles && weeklyMiles > 0 ? totalDurSec / weeklyMiles : null;

  // Streak
  const workouts: WkRow[] = (sessionRows as WkRow[]|null) ?? [];
  const workoutDays = new Set(workouts.map((w) => w.date));
  let streak = 0;
  const sd = new Date();
  if (!workoutDays.has(toDateStr(sd))) sd.setDate(sd.getDate() - 1);
  while (workoutDays.has(toDateStr(sd))) { streak++; sd.setDate(sd.getDate() - 1); }

  // 7-day steps by day
  const stepsByDay = new Map<string, number>();
  for (const r of (stepRows as StRow[]|null) ?? []) {
    const day = toDateStr(new Date(r.timestamp));
    stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + r.value);
  }
  const last7Steps: { day: string; steps: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    last7Steps.push({
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      steps: stepsByDay.get(toDateStr(date)) ?? 0,
    });
  }

  // Activity feed items
  const meals: MRow[] = (mealRows as MRow[]|null) ?? [];
  type FeedItem = { id: string; date: string; type: "workout"|"meal"; label: string; detail: string|null; icon: string };
  const feedItems: FeedItem[] = [];
  for (const w of workouts.slice(0, 20)) {
    feedItems.push({ id: `w-${w.id}`, date: w.date, type: "workout", label: w.type,
      detail: [w.duration_min ? `${w.duration_min} min` : null, w.effort].filter(Boolean).join(" · ") || null, icon: "🏋️" });
  }
  for (const m of meals.slice(0, 30)) {
    feedItems.push({ id: `m-${m.id}`, date: m.date, type: "meal", label: m.name,
      detail: m.calories_est ? `${m.calories_est} kcal · ${m.meal_type}` : m.meal_type,
      icon: m.meal_type === "breakfast" ? "🍳" : m.meal_type === "lunch" ? "🥗" : m.meal_type === "dinner" ? "🍽️" : "🍎" });
  }
  feedItems.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ProgressClient
      withingsCurrent={withingsCurrent}
      withingsDelta30d={withingsDelta30d}
      weeklyMiles={weeklyMiles}
      weeklyRuns={runs.length}
      avgPaceSec={avgPaceSec}
      streak={streak}
      monthWorkouts={workouts.length}
      last7Steps={last7Steps}
      feedItems={feedItems}
      serverTargetWeightLbs={serverTargetWeightLbs}
    />
  );
}
