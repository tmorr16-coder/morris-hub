"use client";

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

function Sparkline({ points, color, height = 40, goalValue }: { points: TrendPoint[]; color: string; height?: number; goalValue?: number }) {
  if (points.length < 2) {
    return <div style={{ height }} />;
  }

  const vals = points.map((p) => p.value);
  // Expand range to include goal line if set
  const allVals = goalValue != null ? [...vals, goalValue] : vals;
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const w = 100;

  const yFor = (v: number) => height - ((v - min) / range) * (height - 4) - 2;

  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = vals.map(yFor);

  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const fillPath = `${path} L${w},${height} L0,${height} Z`;

  const goalY = goalValue != null ? yFor(goalValue) : null;
  const atGoal = goalValue != null && Math.abs(vals[vals.length - 1] - goalValue) < 0.5;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Goal reference line */}
      {goalY != null && (
        <g>
          <line
            x1={0} y1={goalY.toFixed(1)}
            x2={w} y2={goalY.toFixed(1)}
            stroke={atGoal ? "#10b981" : "#e05c3a"}
            strokeWidth="1"
            strokeDasharray="3,2"
            opacity="0.7"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={w - 1}
            y={(goalY - 2).toFixed(1)}
            fontSize="6"
            fill={atGoal ? "#10b981" : "#e05c3a"}
            textAnchor="end"
            fontFamily="Geist, system-ui"
            opacity="0.85"
          >
            goal
          </text>
        </g>
      )}
      {/* Last point dot */}
      <circle
        cx={xs[xs.length - 1].toFixed(1)}
        cy={ys[ys.length - 1].toFixed(1)}
        r="2.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MetricTile({ metric }: { metric: TrendMetric }) {
  const { points, label, unit, color, invertDelta, goalValue } = metric;
  const latest = points[points.length - 1]?.value;
  const earliest = points[0]?.value;
  const delta = latest != null && earliest != null ? latest - earliest : null;
  const daysBack = points.length;

  const isPositive = delta != null ? (invertDelta ? delta < 0 : delta > 0) : null;
  const deltaColor =
    isPositive === null
      ? "var(--color-ink-4)"
      : isPositive
      ? "var(--color-moss)"
      : "#e05c3a";

  const fmtValue = (v: number) => {
    if (unit === "lbs" || unit === "kg") return v.toFixed(1);
    return Math.round(v).toString();
  };

  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: "12px 14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
          {label}
        </span>
        {delta != null && (
          <span style={{ fontSize: 10, color: deltaColor, fontWeight: 500 }}>
            {delta >= 0 ? "+" : ""}{unit === "lbs" || unit === "kg" ? delta.toFixed(1) : Math.round(delta)}{unit === "%" ? "%" : ""}
            <span style={{ color: "var(--color-ink-4)", fontWeight: 400 }}> {daysBack}d</span>
          </span>
        )}
      </div>

      <Sparkline points={points} color={color} height={36} goalValue={goalValue} />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "var(--color-ink)",
          }}>
            {latest != null ? fmtValue(latest) : "—"}
          </span>
          <span style={{ fontSize: 10, color: "var(--color-ink-3)" }}>{unit}</span>
        </div>
        {goalValue != null && (
          <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
            goal {fmtValue(goalValue)}{unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MetricTrendsCard({ metrics }: { metrics: TrendMetric[] }) {
  const available = metrics.filter((m) => m.points.length > 0);
  if (!available.length) return null;

  return (
    <div
      style={{
        background: "var(--color-bg-raised)",
        border: "1px solid var(--color-line)",
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
        30-day trends
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {available.map((m) => (
          <MetricTile key={m.key} metric={m} />
        ))}
      </div>
    </div>
  );
}
