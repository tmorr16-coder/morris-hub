"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Segmented } from "@/components/ios";

export interface DataPoint {
  date: Date;
  [key: string]: number | Date;
}

export interface Metric {
  key: string;
  label: string;
  color: string;
  unit: string;
}

const RANGES = [
  { key: "1M",  days: 30,  ticks: 4 },
  { key: "3M",  days: 90,  ticks: 4 },
  { key: "6M",  days: 180, ticks: 4 },
  { key: "1Y",  days: 365, ticks: 4 },
  { key: "ALL", days: null, ticks: 4 },
] as const;

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface GoalLine {
  metricKey: string;
  value: number;
  label: string;
}

export default function TrendChart({
  data,
  metrics,
  height = 200,
  goalLines = [],
}: {
  data: DataPoint[];
  metrics: Metric[];
  height?: number;
  goalLines?: GoalLine[];
}) {
  const [range, setRange] = useState("3M");
  const [active, setActive] = useState<{ idx: number } | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (!r.days) return data;
    return data.slice(-r.days);
  }, [data, range]);

  const summary = metrics.map((m) => {
    const last = filtered[filtered.length - 1]?.[m.key] as number;
    const first = filtered[0]?.[m.key] as number;
    const delta = ((last ?? 0) - (first ?? 0)).toFixed(1);
    return { ...m, last, delta };
  });

  const PAD = { l: 14, r: 10, t: 20, b: 28 };
  const innerW = Math.max(1, w - PAD.l - PAD.r);
  const innerH = height - PAD.t - PAD.b;

  const visibleMetrics = metrics.filter((m) => !hidden[m.key]);

  const seriesRanges = useMemo(() => {
    const result: Record<string, { min: number; max: number }> = {};
    metrics.forEach((m) => {
      const vals = filtered
        .map((d) => d[m.key] as number)
        .filter((v) => typeof v === "number" && isFinite(v));
      if (!vals.length) { result[m.key] = { min: 0, max: 1 }; return; }
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      const pad = (mx - mn) * 0.15 || 1;
      result[m.key] = { min: mn - pad, max: mx + pad };
    });
    return result;
  }, [filtered, metrics]);

  const n = filtered.length;
  const xFor = (i: number) =>
    PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  const yFor = (v: number, key: string) => {
    const r = seriesRanges[key];
    if (!r) return PAD.t;
    return PAD.t + innerH - ((v - r.min) / (r.max - r.min)) * innerH;
  };

  const pathFor = (key: string) =>
    filtered
      .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(d[key] as number, key).toFixed(1)}`)
      .join(" ");

  const gridCount = 4;
  const gridYs = Array.from({ length: gridCount }, (_, i) =>
    PAD.t + (innerH * i) / (gridCount - 1)
  );

  const rng = RANGES.find((x) => x.key === range)!;
  const xTickIdxs = Array.from({ length: rng.ticks }, (_, i) =>
    Math.min(n - 1, Math.round((i / (rng.ticks - 1)) * (n - 1)))
  ).filter((v, i, a) => a.indexOf(v) === i);

  const onInteract = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ("touches" in e ? e.touches[0]?.clientX : e.clientX) ?? 0;
    const ratio = (px - rect.left - PAD.l) / innerW;
    const idx = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
    setActive({ idx });
  };

  const activePoint = active != null ? filtered[active.idx] : null;
  const ax = active != null ? xFor(active.idx) : null;

  if (!filtered.length) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>No data yet</span>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {/* Summary row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {summary.map((s) => {
          const deltaNum = parseFloat(s.delta);
          const isGood =
            (s.key === "fat" || s.key === "weight")
              ? deltaNum < 0
              : deltaNum > 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
              style={{
                padding: 0,
                textAlign: "left",
                flex: 1,
                minWidth: 0,
                opacity: hidden[s.key] ? 0.3 : 1,
                transition: "opacity 160ms",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block", flexShrink: 0 }} />
                <span className="ios-caption" style={{ fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--ios-label-2)", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span className="ios-num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>
                  {(activePoint ? (activePoint[s.key] as number) : s.last)?.toFixed(1)}
                </span>
                <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{s.unit}</span>
              </div>
              <div className="ios-num" style={{ fontSize: 11, marginTop: 2, color: isGood ? "var(--ios-green)" : "var(--ios-label-2)" }}>
                {deltaNum >= 0 ? "+" : ""}{s.delta}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <svg
        width="100%"
        height={height}
        onMouseMove={onInteract}
        onMouseLeave={() => setActive(null)}
        onTouchMove={onInteract}
        onTouchEnd={() => setActive(null)}
        style={{ display: "block", touchAction: "pan-y" }}
      >
        {/* Horizontal grid */}
        {gridYs.map((y, i) => (
          <line
            key={i}
            x1={PAD.l} y1={y} x2={w - PAD.r} y2={y}
            style={{ stroke: "var(--ios-separator)" }}
            strokeWidth="0.6"
            strokeDasharray={i === gridCount - 1 ? "0" : "2,3"}
          />
        ))}

        {/* X-axis labels */}
        {xTickIdxs.map((idx, i) => (
          <text
            key={i}
            x={xFor(idx)}
            y={height - 8}
            fontSize="9"
            style={{ fill: "var(--ios-label-3)" }}
            textAnchor="middle"
          >
            {fmtDate(filtered[idx].date as Date)}
          </text>
        ))}

        {/* Goal reference lines */}
        {goalLines.map((gl) => {
          if (!seriesRanges[gl.metricKey]) return null;
          const gy = yFor(gl.value, gl.metricKey);
          return (
            <g key={`goal-${gl.metricKey}`}>
              <line x1={PAD.l} y1={gy} x2={w - PAD.r} y2={gy} style={{ stroke: "var(--ios-red)" }} strokeWidth="1" strokeDasharray="4,3" opacity={0.6} />
              <text x={w - PAD.r - 2} y={gy - 3} fontSize="8" style={{ fill: "var(--ios-red)" }} textAnchor="end" fontWeight="600" opacity={0.8}>
                {gl.label}
              </text>
            </g>
          );
        })}

        {/* Series lines */}
        {visibleMetrics.map((m) => (
          <path
            key={m.key}
            d={pathFor(m.key)}
            fill="none"
            stroke={m.color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Hover: vertical line + dots + date */}
        {ax != null && activePoint && (
          <g>
            <line
              x1={ax} y1={PAD.t} x2={ax} y2={height - PAD.b}
              style={{ stroke: "var(--ios-label-3)" }}
              strokeWidth="0.8"
              strokeDasharray="2,3"
            />
            {visibleMetrics.map((m) => (
              <circle
                key={m.key}
                cx={ax}
                cy={yFor(activePoint[m.key] as number, m.key)}
                r="3.5"
                style={{ fill: "var(--ios-cell)" }}
                stroke={m.color}
                strokeWidth="1.5"
              />
            ))}
            <text
              x={ax}
              y={PAD.t - 5}
              fontSize="10"
              style={{ fill: "var(--ios-label)" }}
              textAnchor={ax > w / 2 ? "end" : "start"}
              fontWeight="500"
            >
              {fmtDate(activePoint.date as Date)}
            </text>
          </g>
        )}
      </svg>

      {/* Range picker */}
      <Segmented
        ariaLabel="Time range"
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r.key, label: r.key }))}
        style={{ margin: "10px 0 0" }}
      />
    </div>
  );
}
