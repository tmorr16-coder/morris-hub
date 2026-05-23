import { createServiceClient } from "@/lib/supabase/server";

interface TrendPoint { timestamp: string; value: number }

function trendArrow(recent: number, older: number): { symbol: string; color: string } {
  const delta = ((recent - older) / Math.max(Math.abs(older), 0.001)) * 100;
  if (Math.abs(delta) < 2) return { symbol: "→", color: "var(--color-ink-3)" };
  if (delta > 0) return { symbol: "↑", color: "var(--color-green)" };
  return { symbol: "↓", color: "var(--color-red)" };
}

function weightTrend(points: TrendPoint[]): { current: number | null; arrow: { symbol: string; color: string } | null } {
  if (points.length === 0) return { current: null, arrow: null };
  const recent = points.slice(-7).map((p) => p.value);
  const older = points.slice(-30, -7).map((p) => p.value);
  const avgRecent = recent.reduce((s, v) => s + v, 0) / Math.max(recent.length, 1);
  const avgOlder = older.reduce((s, v) => s + v, 0) / Math.max(older.length, 1);
  const current = points[points.length - 1].value;
  const arrow = older.length > 0
    // For weight, down is good (inverted)
    ? { ...trendArrow(avgRecent, avgOlder), color: avgRecent < avgOlder ? "var(--color-green)" : avgRecent > avgOlder ? "var(--color-red)" : "var(--color-ink-3)" }
    : null;
  return { current, arrow };
}

function avgLast(points: TrendPoint[], days: number): number | null {
  if (points.length === 0) return null;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const slice = points.filter((p) => p.timestamp >= cutoff);
  if (slice.length === 0) return null;
  return Math.round(slice.reduce((s, p) => s + p.value, 0) / slice.length);
}

export default async function HealthSummaryWidget({ userId }: { userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const sevenAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const mondayOfThisWeek = (() => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();
  const mondayLastWeek = (() => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - 7);
    return d.toISOString().slice(0, 10);
  })();
  const sundayLastWeek = (() => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - 1);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: weightRows },
    { data: hrvRows },
    { data: rhrRows },
    { data: sessionsThisWeek },
    { data: sessionsLastWeek },
    { data: ahWorkoutsThisWeek },
  ] = await Promise.all([
    db.from("apple_health_metrics").select("timestamp, value")
      .eq("user_id", userId)
      .eq("metric_name", "weight")
      .gte("timestamp", thirtyAgo).order("timestamp", { ascending: true }),
    db.from("apple_health_metrics").select("timestamp, value")
      .eq("user_id", userId)
      .eq("metric_name", "hrv")
      .gte("timestamp", thirtyAgo).order("timestamp", { ascending: true }),
    db.from("apple_health_metrics").select("timestamp, value")
      .eq("user_id", userId)
      .eq("metric_name", "resting_heart_rate")
      .gte("timestamp", thirtyAgo).order("timestamp", { ascending: true }),
    db.from("workout_sessions").select("date").eq("user_id", userId)
      .gte("date", mondayOfThisWeek),
    db.from("workout_sessions").select("date").eq("user_id", userId)
      .gte("date", mondayLastWeek).lte("date", sundayLastWeek),
    db.from("apple_health_workouts").select("timestamp").eq("user_id", userId)
      .gte("timestamp", sevenAgo),
  ]);

  const weights = (weightRows ?? []) as TrendPoint[];
  const hrv = (hrvRows ?? []) as TrendPoint[];
  const rhr = (rhrRows ?? []) as TrendPoint[];
  const { current: weightNow, arrow: weightArrow } = weightTrend(weights);
  const hrvNow = avgLast(hrv, 7);
  const hrvPrev = (() => {
    const slice = hrv.filter((p) => p.timestamp >= fourteenAgo && p.timestamp < sevenAgo);
    if (slice.length === 0) return null;
    return Math.round(slice.reduce((s, p) => s + p.value, 0) / slice.length);
  })();
  const hrvArrow = hrvNow != null && hrvPrev != null
    ? { ...trendArrow(hrvNow, hrvPrev), color: hrvNow >= hrvPrev ? "var(--color-green)" : "var(--color-red)" }
    : null;
  const rhrNow = avgLast(rhr, 7);

  const workoutsThisWeek = ((sessionsThisWeek ?? []).length) + ((ahWorkoutsThisWeek ?? []).length);
  const workoutsLastWeek = (sessionsLastWeek ?? []).length;
  const workoutArrow = workoutsThisWeek >= workoutsLastWeek
    ? { symbol: workoutsThisWeek > workoutsLastWeek ? "↑" : "→", color: "var(--color-green)" }
    : { symbol: "↓", color: "var(--color-red)" };

  const hasData = weights.length > 0 || hrv.length > 0 || rhr.length > 0;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>
          Health <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>summary</span>
        </h2>
        <a href="https://health.morrisai.family/dashboard" style={{ fontSize: 10, color: "var(--color-ink-3)", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          View →
        </a>
      </div>

      {!hasData ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          No health data yet — sync Apple Health to see trends here.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Metric
            label="Weight"
            value={weightNow != null ? `${weightNow.toFixed(1)} lbs` : "—"}
            arrow={weightArrow}
            sub="vs last 30d"
          />
          <Metric
            label="Workouts this week"
            value={String(workoutsThisWeek)}
            arrow={workoutArrow}
            sub={`${workoutsLastWeek} last week`}
          />
          {hrvNow != null && (
            <Metric
              label="HRV (7d avg)"
              value={`${hrvNow} ms`}
              arrow={hrvArrow}
              sub="vs prior 7d"
            />
          )}
          {rhrNow != null && (
            <Metric
              label="Resting HR"
              value={`${rhrNow} bpm`}
              arrow={null}
              sub="7d avg"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, arrow, sub }: {
  label: string;
  value: string;
  arrow: { symbol: string; color: string } | null;
  sub: string;
}) {
  return (
    <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-rule-soft)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}>{value}</span>
        {arrow && (
          <span style={{ fontSize: 14, color: arrow.color, fontWeight: 600 }}>{arrow.symbol}</span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "18px 20px",
  boxShadow: "var(--shadow-card)",
};
