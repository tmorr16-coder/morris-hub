"use client";

interface SparklineChartProps {
  prices: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export default function SparklineChart({
  prices,
  width = 64,
  height = 24,
  positive,
}: SparklineChartProps) {
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = prices.map((p, i) => [
    pad + (i / (prices.length - 1)) * w,
    pad + h - ((p - min) / range) * h,
  ]);

  // Smooth bezier path
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * 0.4;
    const cp2x = pts[i][0] - (pts[i][0] - pts[i - 1][0]) * 0.4;
    d += ` C ${cp1x.toFixed(1)},${pts[i - 1][1].toFixed(1)} ${cp2x.toFixed(1)},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }

  const isUp = positive ?? prices[prices.length - 1] >= prices[0];
  const color = isUp ? "var(--ios-green)" : "var(--ios-red)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
