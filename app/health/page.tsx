export const revalidate = 3600; // cache for 1 hour

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId, getCurrentUserName } from "@/lib/health/auth";
import { type CombinedWorkoutRow } from "./_components/ActivityHistoryCard";
import { type TrendMetric, type TrendPoint } from "./_components/MetricTrendsCard";
import Link from "next/link";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

// latest value + windowed delta for a trend metric
function trendSummary(m: TrendMetric): { value: string; delta: string; color: string } | null {
  if (!m.points.length) return null;
  const latest = m.points[m.points.length - 1].value;
  const d = latest - m.points[0].value;
  const improving = m.invertDelta ? d < 0 : d > 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    value: `${r1(latest)}${m.unit ? ` ${m.unit}` : ""}`,
    delta: d === 0 ? "no change" : `${d > 0 ? "▲" : "▼"} ${Math.abs(r1(d))} over ${m.points.length}d`,
    color: d === 0 ? "var(--ios-label-2)" : improving ? "var(--ios-green)" : "var(--ios-red)",
  };
}

function workoutMeta(w: CombinedWorkoutRow): string {
  const parts: string[] = [];
  if (w.duration_sec != null) parts.push(`${Math.round(w.duration_sec / 60)} min`);
  if (w.distance_m != null) parts.push(`${(w.distance_m / 1609.344).toFixed(1)} mi`);
  if (w.calories != null) parts.push(`${Math.round(w.calories)} cal`);
  const d = new Date(w.timestamp);
  parts.push(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
  return parts.join(" · ");
}

// ── constants ─────────────────────────────────────────────────────────────────

const SCORE_FALLBACKS = [
  { label: "Readiness", value: 82, color: "var(--color-moss)" },
  { label: "Activity",  value: 74, color: "var(--color-accent)" },
  { label: "Recovery",  value: 88, color: "var(--color-slate)" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoTs: string): string {
  const mins = Math.floor((Date.now() - new Date(isoTs).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function toMiles(value: number, unit: string): number {
  const u = (unit ?? "km").toLowerCase();
  if (u === "mi" || u === "miles") return value;
  if (u === "km") return value / 1.60934;
  return value / 1609.344;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function toLocalDate(d: Date): string {
  return d.toLocaleDateString("sv");
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const [userId, userName] = await Promise.all([getCurrentUserId(), getCurrentUserName()]);


  // Weight goal from user metadata
  const { data: { user: authUser } } = await db.auth.admin.getUserById(userId);
  const targetWeightLbs: number | null = (authUser?.user_metadata?.target_weight_lbs as number | null) ?? null;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  // Rolling 72-hour window — ensures data pushed up to 3 days ago still shows on the dashboard
  const rollingWindowStart = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 14); // 14 days reduces egress vs 30

  const [
    { data: appleLastRow },
    { data: ouraLastSyncRow },
    { data: withingsLastRow },
    { data: stepsRows },
    { data: energyRows },
    { data: distanceRows },
    { data: hrRows },
    { data: mealRows },
    { data: recentAppleWorkoutRows },
    { data: recentSessionRows },
    { data: hrvRows },
    { data: restingHrRows },
    { data: sleepScoreRows },
    { data: weightRows },
  ] = await Promise.all([
    // Per-source last sync times
    db.from("apple_health_metrics")
      .select("created_at")
      .eq("user_id", userId).eq("source", "apple_health")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("apple_health_metrics")
      .select("created_at")
      .eq("user_id", userId).eq("source", "oura")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("apple_health_metrics")
      .select("created_at")
      .eq("user_id", userId).eq("source", "withings")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // Activity — rolling 28h window so delayed Apple Health pushes still populate the cards
    db.from("apple_health_metrics")
      .select("value, source")
      .eq("user_id", userId).eq("source", "apple_health")
      .in("metric_name", ["step_count", "steps", "Step Count", "Steps"])
      .gte("timestamp", rollingWindowStart.toISOString()),
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId).eq("source", "apple_health")
      .in("metric_name", ["active_energy", "active_energy_burned", "calories", "Active Energy", "Active Energy Burned"])
      .gte("timestamp", rollingWindowStart.toISOString()),
    db.from("apple_health_metrics")
      .select("value, unit")
      .eq("user_id", userId).eq("source", "apple_health")
      .in("metric_name", ["walking_running_distance", "Walking + Running Distance", "Walking Running Distance"])
      .gte("timestamp", rollingWindowStart.toISOString()),
    // Heart rate — try instantaneous first, fall back to resting
    db.from("apple_health_metrics")
      .select("value, metric_name")
      .eq("user_id", userId).eq("source", "apple_health")
      .in("metric_name", ["heart_rate", "Heart Rate", "resting_heart_rate", "Resting Heart Rate"])
      .order("timestamp", { ascending: false })
      .limit(1),
    // Today's nutrition summary
    db.from("meals")
      .select("calories_est")
      .eq("user_id", userId)
      .eq("date", new Date().toLocaleDateString("sv")),
    // Recent workouts (last 7 days) — device-synced
    db.from("apple_health_workouts")
      .select("id, timestamp, workout_type, duration_sec, distance_m, calories")
      .eq("user_id", userId)
      .gte("timestamp", sevenDaysAgo.toISOString())
      .order("timestamp", { ascending: false })
      .limit(50),
    // Recent workouts (last 7 days) — manually logged
    db.from("workout_sessions")
      .select("id, date, type, duration_min, distance_miles")
      .eq("user_id", userId)
      .gte("date", toLocalDate(sevenDaysAgo))
      .order("date", { ascending: false })
      .limit(50),
    // 14-day trend data — capped at 200 rows each to bound egress
    db.from("apple_health_metrics")
      .select("timestamp, value")
      .eq("user_id", userId)
      .in("metric_name", ["hrv", "HRV", "heart_rate_variability", "HeartRateVariabilitySDNN"])
      .gte("timestamp", thirtyDaysAgo.toISOString())
      .order("timestamp", { ascending: true })
      .limit(200),
    db.from("apple_health_metrics")
      .select("timestamp, value")
      .eq("user_id", userId)
      .in("metric_name", ["resting_heart_rate", "Resting Heart Rate", "RestingHeartRate"])
      .gte("timestamp", thirtyDaysAgo.toISOString())
      .order("timestamp", { ascending: true })
      .limit(200),
    db.from("apple_health_metrics")
      .select("timestamp, value")
      .eq("user_id", userId)
      .eq("source", "oura")
      .eq("metric_name", "sleep_score")
      .gte("timestamp", thirtyDaysAgo.toISOString())
      .order("timestamp", { ascending: true })
      .limit(200),
    db.from("apple_health_metrics")
      .select("timestamp, value")
      .eq("user_id", userId)
      .eq("source", "withings")
      .eq("metric_name", "weight")
      .gte("timestamp", thirtyDaysAgo.toISOString())
      .order("timestamp", { ascending: true })
      .limit(200),
  ]);

  // ── Oura scores ───────────────────────────────────────────────────────────
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();
  const [
    { data: readinessRow },
    { data: activityRow },
    { data: sleepScoreRow },
  ] = await Promise.all([
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId).eq("source", "oura").eq("metric_name", "readiness_score")
      .gte("timestamp", sevenDaysAgoIso)
      .order("timestamp", { ascending: false }).limit(1).maybeSingle(),
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId).eq("source", "oura").eq("metric_name", "activity_score")
      .gte("timestamp", sevenDaysAgoIso)
      .order("timestamp", { ascending: false }).limit(1).maybeSingle(),
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId).eq("source", "oura").eq("metric_name", "sleep_score")
      .gte("timestamp", sevenDaysAgoIso)
      .order("timestamp", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // ── Derived values ────────────────────────────────────────────────────────

  type ScoreRow = { value: number } | null;
  const SCORES = [
    { label: "Readiness", value: Math.round((readinessRow  as ScoreRow)?.value ?? SCORE_FALLBACKS[0].value), color: SCORE_FALLBACKS[0].color },
    { label: "Activity",  value: Math.round((activityRow   as ScoreRow)?.value ?? SCORE_FALLBACKS[1].value), color: SCORE_FALLBACKS[1].color },
    { label: "Recovery",  value: Math.round((sleepScoreRow as ScoreRow)?.value ?? SCORE_FALLBACKS[2].value), color: SCORE_FALLBACKS[2].color },
  ];

  // Per-source sync timestamps
  type SyncRow = { created_at: string } | null;
  const syncSources = [
    { key: "watch",    icon: "⌚", label: "Watch",    ts: (appleLastRow    as SyncRow)?.created_at ?? null },
    { key: "oura",     icon: "💍", label: "Oura",     ts: (ouraLastSyncRow as SyncRow)?.created_at ?? null },
    { key: "withings", icon: "⚖️", label: "Withings", ts: (withingsLastRow as SyncRow)?.created_at ?? null },
  ].filter((s) => s.ts !== null) as { key: string; icon: string; label: string; ts: string }[];

  type MetricRow = { value: number; source?: string };
  const stepsData = (stepsRows as MetricRow[] | null) ?? [];
  const steps: number | null = stepsData.length
    ? Math.round(stepsData.reduce((s, r) => s + r.value, 0))
    : null;

  const activeEnergyCal: number | null = (energyRows as MetricRow[] | null)?.length
    ? Math.round((energyRows as MetricRow[]).reduce((s, r) => s + r.value, 0))
    : null;

  type DistRow = { value: number; unit: string };
  const distanceMiles: number | null = (distanceRows as DistRow[] | null)?.length
    ? parseFloat((distanceRows as DistRow[]).reduce((s, r) => s + toMiles(r.value, r.unit), 0).toFixed(2))
    : null;

  const hrRow = (hrRows as { value: number; metric_name: string }[] | null)?.[0] ?? null;
  const heartRateBpm: number | null = hrRow?.value ?? null;
  const heartRateLabel = hrRow?.metric_name?.includes("resting") ? "Resting HR" : "Heart Rate";

  type MealRow = { calories_est: number | null };
  const mealData = (mealRows as MealRow[] | null) ?? [];
  const todayCalories = mealData.reduce((sum, m) => sum + (m.calories_est ?? 0), 0);
  const mealCount = mealData.length;

  // Combine device-synced + manually-logged workouts into one list so the
  // activity grid and the workout list below it always agree — previously
  // manually-logged workout_sessions lit up the "active" grid but never
  // appeared in the recent-workouts list, which only read apple_health_workouts.
  type AppleWorkoutRow = { id: string; timestamp: string; workout_type: string; duration_sec: number | null; distance_m: number | null; calories: number | null };
  type SessionRow = { id: string; date: string; type: string; duration_min: number | null; distance_miles: number | null };
  const appleWorkouts: CombinedWorkoutRow[] = ((recentAppleWorkoutRows as AppleWorkoutRow[] | null) ?? []).map((w) => ({
    id: w.id,
    timestamp: w.timestamp,
    workout_type: w.workout_type,
    duration_sec: w.duration_sec,
    distance_m: w.distance_m,
    calories: w.calories,
    source: "apple_health" as const,
  }));
  const manualWorkouts: CombinedWorkoutRow[] = ((recentSessionRows as SessionRow[] | null) ?? []).map((s) => ({
    id: s.id,
    timestamp: `${s.date}T12:00:00`,
    workout_type: s.type,
    duration_sec: s.duration_min != null ? s.duration_min * 60 : null,
    distance_m: s.distance_miles != null ? s.distance_miles * 1609.344 : null,
    calories: null,
    source: "manual" as const,
  }));
  const recentWorkouts: CombinedWorkoutRow[] = [...appleWorkouts, ...manualWorkouts]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // ── 30-day trend metrics ─────────────────────────────────────────────────

  type RawTrendRow = { timestamp: string; value: number };

  function toTrendPoints(rows: RawTrendRow[] | null): TrendPoint[] {
    if (!rows?.length) return [];
    // Deduplicate to one value per day (last reading wins)
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const d = r.timestamp.slice(0, 10);
      byDate.set(d, r.value);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }

  const trendMetrics: TrendMetric[] = [
    {
      key: "hrv",
      label: "HRV",
      unit: "ms",
      color: "var(--color-moss)",
      points: toTrendPoints(hrvRows as RawTrendRow[] | null),
    },
    {
      key: "restingHr",
      label: "Resting HR",
      unit: "bpm",
      color: "var(--color-slate)",
      points: toTrendPoints(restingHrRows as RawTrendRow[] | null),
      invertDelta: true,
    },
    {
      key: "sleep",
      label: "Sleep Score",
      unit: "",
      color: "#6366f1",
      points: toTrendPoints(sleepScoreRows as RawTrendRow[] | null),
    },
    {
      key: "weight",
      label: "Weight",
      unit: "lbs",
      color: "var(--color-accent)",
      points: toTrendPoints(weightRows as RawTrendRow[] | null),
      invertDelta: true,
      goalValue: targetWeightLbs ?? undefined,
    },
  ];

  const today = formatDate(new Date());
  const firstName = (userName ?? "").split(" ")[0];

  return (
    <div className="ios-scroll">
      <LargeTitle title="Health" subtitle={`${today} · ${getGreeting()}${firstName ? `, ${firstName}` : ""}`} avatarInitial={(userName || "T")[0]?.toUpperCase()} />

      {/* Scores hero */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
        {SCORES.map((s) => (
          <div key={s.label}>
            <div className="ios-num" style={{ fontSize: 30, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Group header="Today">
        <Cell chevron={false} lead={<IconBadge color="var(--ios-green)"><Icons.HeartIcon /></IconBadge>} title="Steps" trailing={<span className="ios-num">{steps != null ? steps.toLocaleString() : "—"}</span>} />
        <Cell chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.DumbbellIcon /></IconBadge>} title="Active energy" trailing={<span className="ios-num">{activeEnergyCal != null ? `${activeEnergyCal} cal` : "—"}</span>} />
        <Cell chevron={false} lead={<IconBadge color="var(--ios-tint)"><Icons.TrendUpIcon /></IconBadge>} title="Distance" trailing={<span className="ios-num">{distanceMiles != null ? `${distanceMiles} mi` : "—"}</span>} />
        <Cell chevron={false} lead={<IconBadge color="#FA114F"><Icons.HeartIcon /></IconBadge>} title={heartRateLabel} trailing={<span className="ios-num">{heartRateBpm != null ? `${heartRateBpm} bpm` : "—"}</span>} />
        <Cell href="/health/nutrition" lead={<IconBadge color="#E8734A"><Icons.ForkKnifeIcon /></IconBadge>} title="Nutrition" subtitle={`${mealCount} ${mealCount === 1 ? "meal" : "meals"} logged`} trailing={<span className="ios-num">{todayCalories} cal</span>} />
      </Group>

      <Group header="Trends" footer="Last 14 days.">
        {trendMetrics.map((m) => {
          const t = trendSummary(m);
          return (
            <Cell
              key={m.key}
              chevron={false}
              lead={<IconBadge color="var(--ios-tint)"><Icons.ChartIcon /></IconBadge>}
              title={m.label}
              subtitle={t ? <span style={{ color: t.color }}>{t.delta}</span> : "No data yet"}
              trailing={t ? <span className="ios-num">{t.value}</span> : undefined}
            />
          );
        })}
      </Group>

      {recentWorkouts.length > 0 && (
        <Group header="Recent workouts">
          {recentWorkouts.slice(0, 5).map((w) => (
            <Cell key={w.id} href="/health/train" lead={<IconBadge color="var(--ios-green)"><Icons.DumbbellIcon /></IconBadge>} title={w.workout_type} subtitle={workoutMeta(w)} />
          ))}
        </Group>
      )}

      {syncSources.length > 0 && (
        <Group header="Connected">
          {syncSources.map((s) => (
            <Cell key={s.key} href="/health/settings/integrations" lead={<IconBadge color="#8E8E93"><Icons.HeartIcon /></IconBadge>} title={s.label} trailing={<span style={{ color: "var(--ios-label-2)" }}>{relativeTime(s.ts)}</span>} />
          ))}
        </Group>
      )}

      <div style={{ display: "flex", gap: 10, padding: "14px 16px 0" }}>
        {[
          { href: "/health/train", label: "Log workout", icon: <Icons.DumbbellIcon /> },
          { href: "/health/nutrition", label: "Log meal", icon: <Icons.ForkKnifeIcon /> },
          { href: "/health/medications", label: "Meds", icon: <Icons.PillIcon /> },
        ].map((q) => (
          <Link key={q.label} href={q.href} className="ios-list" style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: 0, color: "var(--ios-tint)" }}>
            <span style={{ display: "flex", width: 22, height: 22 }}>{q.icon}</span>
            <span className="ios-caption" style={{ color: "var(--ios-label)" }}>{q.label}</span>
          </Link>
        ))}
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}
