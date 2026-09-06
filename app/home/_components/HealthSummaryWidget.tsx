import { createServiceClient } from "@/lib/supabase/server";

interface TrendPoint { timestamp: string; value: number }
type Arrow = { symbol: "up" | "down" | "flat"; color: string };

function trendArrow(recent: number, older: number): Arrow {
  const delta = ((recent - older) / Math.max(Math.abs(older), 0.001)) * 100;
  if (Math.abs(delta) < 2) return { symbol: "flat", color: "var(--ios-label-2)" };
  if (delta > 0) return { symbol: "up", color: "var(--ios-green)" };
  return { symbol: "down", color: "var(--ios-red)" };
}

function weightTrend(points: TrendPoint[]): { current: number | null; arrow: Arrow | null } {
  if (points.length === 0) return { current: null, arrow: null };
  const recent = points.slice(-7).map((p) => p.value);
  const older = points.slice(-30, -7).map((p) => p.value);
  const avgRecent = recent.reduce((s, v) => s + v, 0) / Math.max(recent.length, 1);
  const avgOlder = older.reduce((s, v) => s + v, 0) / Math.max(older.length, 1);
  const current = points[points.length - 1].value;
  const arrow: Arrow | null = older.length > 0
    // For weight, down is good (inverted)
    ? { ...trendArrow(avgRecent, avgOlder), color: avgRecent < avgOlder ? "var(--ios-green)" : avgRecent > avgOlder ? "var(--ios-red)" : "var(--ios-label-2)" }
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

function ArrowGlyph({ arrow }: { arrow: Arrow }) {
  const d = arrow.symbol === "up" ? "M6 15l6-6 6 6" : arrow.symbol === "down" ? "M6 9l6 6 6-6" : "M5 12h14";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={arrow.color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden>
      <path d={d} />
    </svg>
  );
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
  const hrvArrow: Arrow | null = hrvNow != null && hrvPrev != null
    ? { ...trendArrow(hrvNow, hrvPrev), color: hrvNow >= hrvPrev ? "var(--ios-green)" : "var(--ios-red)" }
    : null;
  const rhrNow = avgLast(rhr, 7);

  const workoutsThisWeek = ((sessionsThisWeek ?? []).length) + ((ahWorkoutsThisWeek ?? []).length);
  const workoutsLastWeek = (sessionsLastWeek ?? []).length;
  const workoutArrow: Arrow = workoutsThisWeek >= workoutsLastWeek
    ? { symbol: workoutsThisWeek > workoutsLastWeek ? "up" : "flat", color: "var(--ios-green)" }
    : { symbol: "down", color: "var(--ios-red)" };

  const hasData = weights.length > 0 || hrv.length > 0 || rhr.length > 0;

  return (
    <div style={card}>
      <div style={header}>
        <span className="ios-headline">Health summary</span>
        {/* Relative, not https://health.morrisai.family — the per-module
            subdomains are gone and the health module lives at /health on the
            main site. An absolute link here left the app to reach a host that
            no longer resolves. */}
        <a href="/health" className="ios-footnote" style={{ color: "var(--ios-tint)" }}>
          View
        </a>
      </div>

      {!hasData ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "20px 16px", textAlign: "center" }}>
          No health data yet — sync Apple Health to see trends here.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "6px 16px 16px" }}>
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
  arrow: Arrow | null;
  sub: string;
}) {
  return (
    <div style={{ background: "var(--ios-fill)", borderRadius: 12, padding: "12px 14px" }}>
      <div className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span className="ios-num" style={{ fontSize: 20, fontWeight: 600, color: "var(--ios-label)" }}>{value}</span>
        {arrow && <ArrowGlyph arrow={arrow} />}
      </div>
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px 6px",
};
