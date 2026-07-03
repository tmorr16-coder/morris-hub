export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { createClient } from "@/lib/supabase/server";
import { type BiaPoint } from "./_components/ProgressClient";
import {
  LargeTitle, Group, Cell, IconBadge, GlanceGrid, GlanceTile,
  RadialGauge, Sparkline, BarRows, Icons,
} from "@/components/ios";

function toDateStr(d: Date) { return d.toLocaleDateString("sv"); }

function fmtPace(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relativeDay(dateStr: string): string {
  const today = new Date().toLocaleDateString("sv");
  const yesterday = new Date(new Date().getTime() - 86_400_000).toLocaleDateString("sv");
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function ProgressPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const [userId, supabase] = await Promise.all([getCurrentUserId(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const serverTargetWeightLbs: number | null =
    typeof meta.target_weight_lbs === "number" ? meta.target_weight_lbs : null;

  const sevenDaysAgo  = new Date(new Date().getTime() - 7  * 86_400_000);
  const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 86_400_000);

  const twelveWeeksAgo = new Date(new Date().getTime() - 84 * 86_400_000);

  const [
    { data: latestWeightRows },
    { data: oldestWeightRows },
    { data: runRows },
    { data: sessionRows },
    { data: mealRows },
    { data: stepRows },
    { data: bodyCompRows },
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
    // 12-week Withings BIA — weight, muscle_mass, fat_mass
    db.from("apple_health_metrics")
      .select("metric_name, value, timestamp")
      .eq("user_id", userId).eq("source", "withings")
      .in("metric_name", ["weight", "muscle_mass", "fat_mass"])
      .gte("timestamp", twelveWeeksAgo.toISOString())
      .order("timestamp", { ascending: true }),
  ]);

  type WtRow  = { value: number };
  type RunRow = { duration_sec: number | null; distance_m: number | null };
  type WkRow  = { id: string; date: string; type: string; duration_min: number | null; effort: string | null };
  type MRow   = { id: string; date: string; meal_type: string; name: string; calories_est: number | null };
  type StRow  = { value: number; timestamp: string };
  type BiaRow = { metric_name: string; value: number; timestamp: string };

  // Build body comp series from Withings BIA data (bucket by week)
  // BiaPoint type imported from ProgressClient
  const biaRows: BiaRow[] = (bodyCompRows as BiaRow[] | null) ?? [];

  // Group by ISO week (take latest reading per week per metric)
  const weekMap = new Map<string, { weight?: number; muscle?: number; fat?: number; ts: string }>();
  for (const r of biaRows) {
    const d = new Date(r.timestamp);
    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7).toString().padStart(2, "0")}`;
    const entry = weekMap.get(weekKey) ?? { ts: r.timestamp };
    if (r.metric_name === "weight") entry.weight = r.value;
    if (r.metric_name === "muscle_mass") entry.muscle = r.value;
    if (r.metric_name === "fat_mass") entry.fat = r.value;
    weekMap.set(weekKey, { ...entry, ts: r.timestamp });
  }
  const biaPoints: BiaPoint[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8) // last 8 weeks
    .map(([, v]) => ({
      ts: v.ts,
      label: new Date(v.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      weight: v.weight ?? null,
      muscle: v.muscle ?? null,
      fat: v.fat ?? null,
    }));

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

  // ── Chart series (real Withings body-scan data) ──────────────────────────
  const weightSeries = biaPoints.map((p) => p.weight).filter((v): v is number => v != null);
  const muscleSeries = biaPoints.map((p) => p.muscle).filter((v): v is number => v != null);
  const fatSeries    = biaPoints.map((p) => p.fat).filter((v): v is number => v != null);

  let goalFrac: number | null = null;
  if (serverTargetWeightLbs != null && withingsCurrent != null) {
    const startW = weightSeries[0] ?? withingsCurrent;
    const denom = startW - serverTargetWeightLbs;
    goalFrac = denom !== 0 ? Math.min(1, Math.max(0, (startW - withingsCurrent) / denom)) : 1;
  }

  const deltaLabel = withingsDelta30d != null
    ? `${withingsDelta30d > 0 ? "+" : ""}${withingsDelta30d.toFixed(1)} lb · 30d`
    : null;
  const deltaColor = withingsDelta30d != null && withingsDelta30d < 0 ? "var(--ios-green)" : "var(--ios-label-2)";

  const hasSteps = last7Steps.some((d) => d.steps > 0);

  return (
    <div className="ios-scroll">
      <LargeTitle title="Progress" subtitle="How you're trending" />

      {goalFrac != null && withingsCurrent != null && (
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: "18px 16px", display: "flex", alignItems: "center", gap: 20 }}>
          <RadialGauge
            value={goalFrac}
            color="#356FB0"
            label="To goal"
            center={<span className="ios-num" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(goalFrac * 100)}%</span>}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="ios-num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
              {withingsCurrent.toFixed(1)}
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ios-label-2)" }}> lb</span>
            </span>
            {deltaLabel && <span className="ios-footnote" style={{ color: deltaColor }}>{deltaLabel}</span>}
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Goal {serverTargetWeightLbs} lb</span>
          </div>
        </div>
      )}

      <GlanceGrid>
        <GlanceTile label="Streak" accent="var(--ios-orange)" icon={<Icons.SparkleIcon />} value={streak} sub={`day${streak === 1 ? "" : "s"} in a row`} href="/health/train" />
        <GlanceTile label="This month" icon={<Icons.DumbbellIcon />} value={workouts.length} sub={`workout${workouts.length === 1 ? "" : "s"}`} href="/health/train" />
        <GlanceTile label="Weekly miles" accent="var(--ios-green)" icon={<Icons.TrendUpIcon />} value={weeklyMiles != null ? weeklyMiles.toFixed(1) : "—"} sub={`${runs.length} run${runs.length === 1 ? "" : "s"}`} href="/health/train" />
        <GlanceTile label="Avg pace" icon={<Icons.HeartIcon />} value={fmtPace(avgPaceSec)} sub="min/mi" href="/health/train" />
      </GlanceGrid>

      {weightSeries.length >= 2 && (
        <Group header="Body trends" footer="Withings body scans, most recent weeks.">
          <div className="ios-cell">
            <span className="ios-cell-body">
              <span className="ios-cell-title">Weight</span>
              {deltaLabel && <span className="ios-cell-sub" style={{ color: deltaColor }}>{deltaLabel}</span>}
            </span>
            <Sparkline points={weightSeries} color="var(--ios-tint)" width={104} height={34} />
            <span className="ios-num" style={{ width: 62, textAlign: "right", fontWeight: 600 }}>{weightSeries[weightSeries.length - 1].toFixed(1)}</span>
          </div>
          {muscleSeries.length >= 2 && (
            <div className="ios-cell">
              <span className="ios-cell-body"><span className="ios-cell-title">Lean mass</span></span>
              <Sparkline points={muscleSeries} color="var(--ios-green)" width={104} height={34} />
              <span className="ios-num" style={{ width: 62, textAlign: "right", fontWeight: 600 }}>{muscleSeries[muscleSeries.length - 1].toFixed(1)}</span>
            </div>
          )}
          {fatSeries.length >= 2 && (
            <div className="ios-cell">
              <span className="ios-cell-body"><span className="ios-cell-title">Body fat</span></span>
              <Sparkline points={fatSeries} color="var(--ios-orange)" width={104} height={34} />
              <span className="ios-num" style={{ width: 62, textAlign: "right", fontWeight: 600 }}>{fatSeries[fatSeries.length - 1].toFixed(1)}</span>
            </div>
          )}
        </Group>
      )}

      {hasSteps && (
        <Group header="Steps · last 7 days">
          <BarRows items={last7Steps.map((d) => ({ label: d.day, value: d.steps, display: d.steps.toLocaleString(), color: "var(--ios-green)" }))} />
        </Group>
      )}

      {feedItems.length > 0 && (
        <Group header="Activity">
          {feedItems.slice(0, 12).map((it) => (
            <Cell
              key={it.id}
              chevron={false}
              lead={<IconBadge color={it.type === "workout" ? "var(--ios-green)" : "var(--ios-orange)"}><span style={{ fontSize: 15 }}>{it.icon}</span></IconBadge>}
              title={it.label}
              subtitle={[relativeDay(it.date), it.detail].filter(Boolean).join(" · ")}
            />
          ))}
        </Group>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
