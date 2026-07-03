import { Group, Sparkline } from "@/components/ios";

export interface TrendPoint {
  date: string;  // YYYY-MM-DD
  value: number;
}

export interface TrendMetric {
  key: string;
  label: string;
  unit: string;
  color: string;
  points: TrendPoint[];
  /** true = lower is better (weight, resting HR) */
  invertDelta?: boolean;
  /** Show a dashed goal reference line at this value */
  goalValue?: number;
}

function fmtValue(v: number, unit: string): string {
  if (unit === "lbs" || unit === "kg") return v.toFixed(1);
  return Math.round(v).toString();
}

function MetricRow({ metric }: { metric: TrendMetric }) {
  const { points, label, unit, invertDelta, goalValue } = metric;
  const latest = points[points.length - 1]?.value;
  const earliest = points[0]?.value;
  const delta = latest != null && earliest != null ? latest - earliest : null;
  const daysBack = points.length;

  const improving = delta != null ? (invertDelta ? delta < 0 : delta > 0) : null;
  const deltaColor =
    improving === null ? "var(--ios-label-2)" : improving ? "var(--ios-green)" : "var(--ios-red)";

  const vals = points.map((p) => p.value);

  const sub =
    delta == null
      ? "No data yet"
      : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(unit === "lbs" || unit === "kg" ? delta : Math.round(delta))}${unit === "%" ? "%" : ""} over ${daysBack}d`;

  return (
    <div className="ios-cell">
      <span className="ios-cell-body">
        <span className="ios-cell-title">{label}</span>
        <span className="ios-cell-sub" style={{ color: deltaColor }}>{sub}</span>
        {goalValue != null && (
          <span className="ios-cell-sub" style={{ color: "var(--ios-label-3)" }}>
            Goal {fmtValue(goalValue, unit)}{unit}
          </span>
        )}
      </span>
      {vals.length >= 2 && <Sparkline points={vals} color="var(--ios-tint)" width={92} height={32} />}
      <span className="ios-num" style={{ width: 66, textAlign: "right", fontWeight: 600 }}>
        {latest != null ? `${fmtValue(latest, unit)}${unit ? ` ${unit}` : ""}` : "—"}
      </span>
    </div>
  );
}

export default function MetricTrendsCard({ metrics }: { metrics: TrendMetric[] }) {
  const available = metrics.filter((m) => m.points.length > 0);
  if (!available.length) return null;

  return (
    <Group header="30-day trends">
      {available.map((m) => (
        <MetricRow key={m.key} metric={m} />
      ))}
    </Group>
  );
}
