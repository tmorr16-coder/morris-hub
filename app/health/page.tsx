export const revalidate = 3600; // cache for 1 hour

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId, getCurrentUserName } from "@/lib/health/auth";
import ScoreRings from "./_components/ScoreRings";
import Greeting from "./_components/Greeting";
import ActivityCard from "./_components/ActivityCard";
import RecentWorkoutsCard, { type WorkoutRow } from "./_components/RecentWorkoutsCard";
import ChatWidget from "./_components/ChatWidget";
import CommunityFeed from "./_components/CommunityFeed";
import MetricTrendsCard, { type TrendMetric, type TrendPoint } from "./_components/MetricTrendsCard";
import SyncButton from "./_components/SyncButton";

// ── constants ─────────────────────────────────────────────────────────────────

const SCORE_FALLBACKS = [
  { label: "Readiness", value: 82, color: "var(--color-moss)" },
  { label: "Activity",  value: 74, color: "var(--color-accent)" },
  { label: "Recovery",  value: 88, color: "var(--color-slate)" },
];

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

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

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
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

  const monday    = getMondayOf(todayStart);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const [
    { data: appleLastRow },
    { data: ouraLastSyncRow },
    { data: withingsLastRow },
    { data: stepsRows },
    { data: energyRows },
    { data: distanceRows },
    { data: hrRows },
    { data: mealRows },
    { data: recentWorkoutRows },
    { data: weekSessionRows },
    { data: weekAppleRows },
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
    // Recent workouts (last 7 days)
    db.from("apple_health_workouts")
      .select("id, timestamp, workout_type, duration_sec, distance_m, calories")
      .eq("user_id", userId)
      .gte("timestamp", sevenDaysAgo.toISOString())
      .order("timestamp", { ascending: false })
      .limit(50),
    // This week's workout sessions
    db.from("workout_sessions")
      .select("date")
      .eq("user_id", userId)
      .gte("date", toLocalDate(monday))
      .lt("date", toLocalDate(nextMonday)),
    db.from("apple_health_workouts")
      .select("timestamp")
      .eq("user_id", userId)
      .gte("timestamp", monday.toISOString())
      .lt("timestamp", nextMonday.toISOString()),
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
  const scoresFromOura = !!(readinessRow || activityRow || sleepScoreRow);
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
  const activitySource: string | null = stepsData[0]?.source ?? null;

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

  const recentWorkouts: WorkoutRow[] = (recentWorkoutRows as WorkoutRow[] | null) ?? [];

  // This week active days
  const activeDays = new Set<number>();
  (weekSessionRows as { date: string }[] | null)?.forEach((r) => {
    const d = new Date(r.date + "T00:00:00");
    activeDays.add((d.getDay() + 6) % 7);
  });
  (weekAppleRows as { timestamp: string }[] | null)?.forEach((r) => {
    const d = new Date(r.timestamp);
    activeDays.add((d.getDay() + 6) % 7);
  });
  const todayIdx = (todayStart.getDay() + 6) % 7;

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

  const healthSystemContext = `You are a knowledgeable health and fitness coach. Give concise, practical advice about nutrition, exercise, recovery, and wellness. Keep replies to 2-4 sentences unless more detail is genuinely needed. Be direct and specific. The user is tracking their health data including steps, sleep, readiness, and workouts.`;

  return (
    <div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-ink-3)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            {today}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SyncButton />
            <Link
              href="/health/settings/integrations"
              style={{
                fontSize: 11,
                color: "var(--color-ink-3)",
                textDecoration: "none",
                padding: "4px 10px",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
              }}
            >
              ⚙ Integrations
            </Link>
          </div>
        </div>

        <Greeting name={userName} />

        {/* Per-source sync status */}
        {syncSources.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {syncSources.map(({ key, icon, label, ts }) => (
              <div
                key={key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "var(--color-bg-raised)",
                  border: "1px solid var(--color-line)",
                  fontSize: 11,
                  color: "var(--color-ink-3)",
                }}
              >
                <span style={{ fontSize: 12 }}>{icon}</span>
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span style={{ color: "var(--color-ink-4)" }}>·</span>
                <span>{relativeTime(ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Quick-start workout — replaced by Train page */}

        {/* This week */}
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "14px 16px",
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
            This week
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
            {WEEK_DAYS.map((label, i) => {
              const isActive = activeDays.has(i);
              const isToday  = i === todayIdx;
              return (
                <div
                  key={i}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: isToday ? "var(--color-ink-2)" : "var(--color-ink-4)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isActive ? "var(--color-moss)" : isToday ? "var(--color-bg-sunk)" : "transparent",
                      border: isToday && !isActive ? "1.5px solid var(--color-line-2)" : "1.5px solid transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 150ms",
                    }}
                  >
                    {isActive && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity + Scores */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <ActivityCard
            steps={steps}
            activeEnergyCal={activeEnergyCal}
            distanceMiles={distanceMiles}
            heartRateBpm={heartRateBpm}
            heartRateLabel={heartRateLabel}
            source={activitySource}
          />
          {scoresFromOura ? (
            <div
              style={{
                background: "var(--color-bg-raised)",
                border: "1px solid var(--color-line)",
                borderRadius: 14,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
                  Today&apos;s Scores
                </div>
                <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>via 💍 Oura</div>
              </div>
              <ScoreRings scores={SCORES} />
            </div>
          ) : (
            <Link href="/health/settings/integrations" style={{ textDecoration: "none" }}>
              <div
                style={{
                  background: "var(--color-bg-raised)",
                  border: "1px dashed var(--color-line)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 28, flexShrink: 0 }}>💍</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", marginBottom: 2 }}>Connect Oura Ring</div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Readiness, activity & sleep scores</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 16, color: "var(--color-ink-3)" }}>→</div>
              </div>
            </Link>
          )}
        </div>

        {/* 30-day trends */}
        <MetricTrendsCard metrics={trendMetrics} />

        {/* Nutrition summary */}
        <Link href="/health/nutrition" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3)",
                }}
              >
                Today&apos;s Nutrition
              </div>
              <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Log meals →</span>
            </div>
            {mealCount > 0 ? (
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--color-ink)" }}>
                    {todayCalories.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 2 }}>kcal logged</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                  {mealCount} meal{mealCount !== 1 ? "s" : ""} today
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>
                No meals logged yet today. Tap to add.
              </div>
            )}
          </div>
        </Link>

        {/* Health chat */}
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "16px",
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
            Health coach
          </div>
          <ChatWidget
            systemContext={healthSystemContext}
            placeholder="Ask about nutrition, recovery, fitness…"
            welcomeMessage="Hi! Ask me anything about nutrition, workouts, recovery, or your health data."
            compact
          />
        </div>

        {/* Community feed */}
        <CommunityFeed />

        {/* Recent Workouts */}
        <RecentWorkoutsCard workouts={recentWorkouts} />

      </div>
    </div>
  );
}
