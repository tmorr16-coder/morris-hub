"use client";

import { useState, useEffect, useRef } from "react";

interface CandlePoint {
  time: number;
  close: number;
}

interface PriceChartProps {
  ticker: string;
  currentPrice: number;
  changeDirection: "up" | "down" | "neutral";
}

const RANGES = [
  { label: "1D", range: "1d", interval: "5m" },
  { label: "1M", range: "1mo", interval: "1d" },
  { label: "3M", range: "3mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1wk" },
] as const;

function buildSvgPath(
  points: CandlePoint[],
  width: number,
  height: number
): { line: string; area: string } {
  if (points.length < 2) return { line: "", area: "" };

  const prices = points.map((p) => p.close);
  const min = Math.min(...prices) * 0.998;
  const max = Math.max(...prices) * 1.002;
  const range = max - min || 1;

  const padX = 0;
  const padY = 16;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const pts = points.map((p, i) => [
    padX + (i / (points.length - 1)) * w,
    padY + h - ((p.close - min) / range) * h,
  ]);

  let line = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * 0.4;
    const cp2x = pts[i][0] - (pts[i][0] - pts[i - 1][0]) * 0.4;
    line += ` C ${cp1x.toFixed(1)},${pts[i - 1][1].toFixed(1)} ${cp2x.toFixed(1)},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }

  const area =
    line +
    ` L ${pts[pts.length - 1][0].toFixed(1)},${height} L ${pts[0][0].toFixed(1)},${height} Z`;

  return { line, area };
}

function formatDateLabel(timestamp: number, resolution: string): string {
  const d = new Date(timestamp);
  if (resolution === "60") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PriceChart({ ticker, currentPrice, changeDirection }: PriceChartProps) {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [points, setPoints] = useState<CandlePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 200 });

  const range = RANGES[rangeIdx];
  const isUp = changeDirection !== "down";
  const lineColor = isUp ? "var(--color-green)" : "var(--color-red)";
  const areaColor = isUp ? "rgba(74,107,58,0.07)" : "rgba(154,59,42,0.07)";

  useEffect(() => {
    // Measure immediately on mount, then watch for resizes
    if (containerRef.current) {
      setSize({ width: containerRef.current.offsetWidth, height: 200 });
    }
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSize({ width: e.contentRect.width, height: 200 });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/investments/candle?ticker=${ticker}&range=${range.range}&interval=${range.interval}`
    )
      .then((r) => r.json())
      .then((data) => {
        setPoints(data.points || []);
      })
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [ticker, range.resolution, range.days]);

  const { line, area } = buildSvgPath(points, size.width, size.height);

  // Y-axis price labels
  const prices = points.map((p) => p.close);
  const priceMin = prices.length ? Math.min(...prices) * 0.998 : 0;
  const priceMax = prices.length ? Math.max(...prices) * 1.002 : 0;
  const priceRange = priceMax - priceMin || 1;
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    value: priceMin + frac * priceRange,
    y: 16 + (1 - frac) * (size.height - 32),
  }));

  // X-axis date labels (6 evenly spaced)
  const xLabels =
    points.length > 1
      ? [0, 0.2, 0.4, 0.6, 0.8, 1].map((frac) => {
          const idx = Math.min(Math.round(frac * (points.length - 1)), points.length - 1);
          return {
            label: formatDateLabel(points[idx].time, range.resolution),
            x: frac * size.width,
          };
        })
      : [];

  return (
    <div>
      {/* Range buttons */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, justifyContent: "flex-end" }}>
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRangeIdx(i)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-rule)",
              background: i === rangeIdx ? "var(--color-accent)" : "transparent",
              color: i === rangeIdx ? "#FFFDF8" : "var(--color-ink-3)",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        {size.width === 0 || loading ? (
          <div
            style={{
              height: size.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--color-ink-3)",
            }}
          >
            Loading chart…
          </div>
        ) : points.length < 2 ? (
          <div
            style={{
              height: size.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--color-ink-3)",
            }}
          >
            No chart data available
          </div>
        ) : (
          <svg
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            style={{ overflow: "visible" }}
          >
            {/* Y-axis guide lines */}
            {yLabels.map((l, i) => (
              <g key={i}>
                <line
                  x1={0}
                  y1={l.y}
                  x2={size.width}
                  y2={l.y}
                  stroke="var(--color-rule)"
                  strokeWidth={0.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={2}
                  y={l.y - 3}
                  fontSize={10}
                  fill="var(--color-ink-4)"
                  textAnchor="start"
                >
                  ${l.value.toFixed(0)}
                </text>
              </g>
            ))}

            {/* Area fill */}
            <path d={area} fill={areaColor} />

            {/* Price line */}
            <path
              d={line}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* X-axis labels */}
            {xLabels.map((l, i) => (
              <text
                key={i}
                x={l.x}
                y={size.height - 2}
                fontSize={10}
                fill="var(--color-ink-4)"
                textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              >
                {l.label}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
