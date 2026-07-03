import type { ReactNode } from "react";

/**
 * iOS-native chart primitives. All single-series (one hue each) and label-backed,
 * following the dataviz method: thin 2px marks, rounded caps, recessive track,
 * an area gradient, and a single emphasized endpoint. No axes/legend — the
 * surrounding cell names the metric; deltas wear text tokens, not the mark hue.
 */

/** Single radial progress gauge (0–1). Score/number goes in `center`. */
export function RadialGauge({
  value,
  color,
  size = 76,
  label,
  center,
}: {
  value: number;
  color: string;
  size?: number;
  label?: string;
  center?: ReactNode;
}) {
  const stroke = Math.round(size * 0.11);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - v)} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{center}</div>
      </div>
      {label && <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{label}</span>}
    </div>
  );
}

/** Area sparkline: 2px line, single-hue gradient fill, one emphasized endpoint.
 *  Rendered at fixed px (no non-uniform scaling) so marks stay undistorted. */
export function Sparkline({
  points,
  color = "var(--ios-tint)",
  width = 112,
  height = 36,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (val: number) => height - pad - ((val - min) / span) * (height - pad * 2);
  const line = points.map((val, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const id = `spark-${Math.round(points[0])}-${points.length}-${Math.round(max)}`;
  const ex = x(points.length - 1);
  const ey = y(points[points.length - 1]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="3" fill={color} />
    </svg>
  );
}

/** Horizontal magnitude bars (labeled). One row per item; value labels required. */
export function BarRows({
  items,
}: {
  items: { label: string; value: number; display?: string; color: string }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px" }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="ios-subhead">{it.label}</span>
            <span className="ios-subhead ios-num" style={{ color: "var(--ios-label-2)" }}>{it.display ?? it.value}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--ios-fill)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max((it.value / max) * 100, 3)}%`, height: "100%", borderRadius: 4, background: it.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** GitHub-style day heatmap (single hue by intensity). `days` newest-last. */
export function HeatStrip({
  days,
  color = "var(--ios-green)",
  weeks = 10,
}: {
  days: { level: number }[]; // level 0–1
  color?: string;
  weeks?: number;
}) {
  const cells = days.slice(-weeks * 7);
  const cols: { level: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
  return (
    <div style={{ display: "flex", gap: 3, padding: "14px 16px", overflowX: "auto" }}>
      {cols.map((col, ci) => (
        <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {col.map((d, ri) => (
            <span
              key={ri}
              style={{
                width: 12, height: 12, borderRadius: 3,
                background: d.level > 0 ? color : "var(--ios-fill)",
                opacity: d.level > 0 ? 0.35 + d.level * 0.65 : 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
