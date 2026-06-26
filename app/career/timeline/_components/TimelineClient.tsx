"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  title: string;
  target_date: string | null;
  completed: boolean;
}

interface Goal {
  id: string;
  title: string;
  category: string;
  horizon: string;
  start_date: string | null;
  target_date: string | null;
  progress_pct: number;
  color_tag: string | null;
  status: string;
  milestones: Milestone[];
}

interface TimelineClientProps {
  goals: Goal[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LANE_HEIGHT = 110;
const LANE_LABEL_WIDTH = 100;
const BAR_HEIGHT = 28;
const BAR_MARGIN_TOP = (LANE_HEIGHT - BAR_HEIGHT) / 2;
const MONTH_TICK_INTERVAL = 3; // every 3 months
const SVG_PADDING_TOP = 40; // for axis labels
const SVG_PADDING_BOTTOM = 20;
const MIN_VISIBLE_BAR_WIDTH = 4;

const HORIZONS = ["short-term", "medium-term", "long-term"] as const;
const HORIZON_LABELS: Record<string, string> = {
  "short-term": "Short-term",
  "medium-term": "Medium-term",
  "long-term": "Long-term",
};

// Horizon fallback duration in ms if no target_date
const HORIZON_FALLBACK_MS: Record<string, number> = {
  "short-term": 6 * 30 * 24 * 60 * 60 * 1000,
  "medium-term": 18 * 30 * 24 * 60 * 60 * 1000,
  "long-term": 4 * 365 * 24 * 60 * 60 * 1000,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function TimelineClient({ goals }: TimelineClientProps) {
  const router = useRouter();
  const [horizonFilter, setHorizonFilter] = useState<"all" | "short-term" | "medium-term" | "long-term">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");

  const categories = useMemo(() => {
    const cats = new Set(goals.map((g) => g.category));
    return Array.from(cats).sort();
  }, [goals]);

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (horizonFilter !== "all" && g.horizon !== horizonFilter) return false;
      if (categoryFilter !== "all" && g.category !== categoryFilter) return false;
      return true;
    });
  }, [goals, horizonFilter, categoryFilter]);

  const goalsWithDates = filteredGoals.filter((g) => g.target_date || g.start_date);
  const goalsWithoutDates = filteredGoals.filter((g) => !g.target_date && !g.start_date);

  // ── Date range ────────────────────────────────────────────────────────────

  const now = new Date();
  const today = now.getTime();

  const allDates = goalsWithDates.flatMap((g) => {
    const start = g.start_date ? new Date(g.start_date).getTime() : today;
    const end = g.target_date
      ? new Date(g.target_date).getTime()
      : start + (HORIZON_FALLBACK_MS[g.horizon] ?? HORIZON_FALLBACK_MS["long-term"]);
    return [start, end];
  });

  const thirtyDaysAgo = today - 30 * 24 * 60 * 60 * 1000;
  const fiveYearsAhead = today + 5 * 365 * 24 * 60 * 60 * 1000;

  const minDate = allDates.length > 0 ? Math.min(...allDates, thirtyDaysAgo) : thirtyDaysAgo;
  const maxDate = allDates.length > 0 ? Math.max(...allDates, fiveYearsAhead) : fiveYearsAhead;

  const totalMs = maxDate - minDate;

  // ── SVG dimensions ────────────────────────────────────────────────────────

  const svgWidth = Math.max(900, 1200);
  const plotWidth = svgWidth - LANE_LABEL_WIDTH;
  const svgHeight = HORIZONS.length * LANE_HEIGHT + SVG_PADDING_TOP + SVG_PADDING_BOTTOM;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function dateToX(ms: number): number {
    return LANE_LABEL_WIDTH + ((ms - minDate) / totalMs) * plotWidth;
  }

  function laneY(horizon: string): number {
    const idx = HORIZONS.indexOf(horizon as typeof HORIZONS[number]);
    return SVG_PADDING_TOP + (idx >= 0 ? idx : 0) * LANE_HEIGHT;
  }

  // ── Month ticks ───────────────────────────────────────────────────────────

  const monthTicks = useMemo(() => {
    const ticks: { label: string; x: number }[] = [];
    const start = new Date(minDate);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const d = new Date(start);
    while (d.getTime() <= maxDate) {
      if (d.getMonth() % MONTH_TICK_INTERVAL === 0) {
        const x = dateToX(d.getTime());
        const label = d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        ticks.push({ label, x });
      }
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, maxDate, plotWidth]);

  const todayX = dateToX(today);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
          maxWidth: 1280,
          margin: "0 auto 24px",
        }}
      >
        {/* Horizon filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Horizon:
          </span>
          {(["all", "short-term", "medium-term", "long-term"] as const).map((h) => (
            <FilterButton
              key={h}
              active={horizonFilter === h}
              onClick={() => setHorizonFilter(h)}
              label={h === "all" ? "All" : HORIZON_LABELS[h]}
            />
          ))}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Category:
            </span>
            <FilterButton active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")} label="All" />
            {categories.map((c) => (
              <FilterButton key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} label={c} />
            ))}
          </div>
        )}
      </div>

      {/* SVG Timeline */}
      <div
        style={{
          overflowX: "auto",
          background: "var(--color-bg-raised, #fff)",
          border: "1px solid var(--color-line, #e5e2da)",
          borderRadius: 12,
          maxWidth: "100%",
        }}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: "block", fontFamily: "inherit" }}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {/* Lane backgrounds */}
          {HORIZONS.map((horizon, i) => {
            const y = laneY(horizon);
            return (
              <rect
                key={horizon}
                x={0}
                y={y}
                width={svgWidth}
                height={LANE_HEIGHT}
                fill={i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.018)"}
              />
            );
          })}

          {/* Month grid lines */}
          {monthTicks.map((tick, i) => (
            <line
              key={i}
              x1={tick.x}
              y1={SVG_PADDING_TOP}
              x2={tick.x}
              y2={svgHeight - SVG_PADDING_BOTTOM}
              stroke="var(--color-line, #e5e2da)"
              strokeWidth={1}
              strokeDasharray="2,4"
            />
          ))}

          {/* Month labels */}
          {monthTicks.map((tick, i) => (
            <text
              key={i}
              x={tick.x + 3}
              y={SVG_PADDING_TOP - 6}
              fontSize={10}
              fill="var(--color-ink-4, #b8af9f)"
              fontFamily="inherit"
            >
              {tick.label}
            </text>
          ))}

          {/* Today line */}
          <line
            x1={todayX}
            y1={SVG_PADDING_TOP - 4}
            x2={todayX}
            y2={svgHeight - SVG_PADDING_BOTTOM}
            stroke="#c0392b"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
          <text
            x={todayX + 4}
            y={SVG_PADDING_TOP - 6}
            fontSize={10}
            fill="#c0392b"
            fontWeight="600"
            fontFamily="inherit"
          >
            Today
          </text>

          {/* Lane labels */}
          {HORIZONS.map((horizon) => {
            const y = laneY(horizon);
            return (
              <text
                key={horizon}
                x={8}
                y={y + LANE_HEIGHT / 2 + 4}
                fontSize={11}
                fontWeight={600}
                fill="var(--color-ink-3, #8a8278)"
                textAnchor="start"
                fontFamily="inherit"
              >
                {HORIZON_LABELS[horizon]}
              </text>
            );
          })}

          {/* Goal bars */}
          {goalsWithDates.map((goal) => {
            const color = goal.color_tag ?? "#3B5C7F";
            const startMs = goal.start_date ? new Date(goal.start_date).getTime() : today;
            const endMs = goal.target_date
              ? new Date(goal.target_date).getTime()
              : startMs + (HORIZON_FALLBACK_MS[goal.horizon] ?? HORIZON_FALLBACK_MS["long-term"]);

            const x = dateToX(startMs);
            const barWidth = Math.max(MIN_VISIBLE_BAR_WIDTH, dateToX(endMs) - x);
            const y = laneY(goal.horizon) + BAR_MARGIN_TOP;
            const progress = Math.min(1, Math.max(0, (goal.progress_pct ?? 0) / 100));
            const progressWidth = barWidth * progress;

            const titleFits = barWidth > 60;

            return (
              <g
                key={goal.id}
                style={{ cursor: "pointer" }}
                onClick={() => router.push(`/career/goals/${goal.id}`)}
                aria-label={goal.title}
              >
                {/* Bar background */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={BAR_HEIGHT}
                  rx={6}
                  ry={6}
                  fill={color}
                  fillOpacity={0.22}
                  stroke={color}
                  strokeWidth={1.5}
                />

                {/* Progress fill */}
                {progressWidth > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={progressWidth}
                    height={BAR_HEIGHT}
                    rx={6}
                    ry={6}
                    fill={color}
                    fillOpacity={0.55}
                  />
                )}

                {/* Title */}
                {titleFits ? (
                  <text
                    x={x + 8}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize={11}
                    fontWeight={600}
                    fill={color}
                    fontFamily="inherit"
                    clipPath={`url(#clip-${goal.id})`}
                  >
                    {goal.title}
                  </text>
                ) : (
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    fontSize={10}
                    fill={color}
                    textAnchor="middle"
                    fontFamily="inherit"
                  >
                    {goal.title.substring(0, 12)}{goal.title.length > 12 ? "…" : ""}
                  </text>
                )}

                {/* Clip path for title */}
                <defs>
                  <clipPath id={`clip-${goal.id}`}>
                    <rect x={x} y={y} width={barWidth - 4} height={BAR_HEIGHT} />
                  </clipPath>
                </defs>

                {/* Milestones as diamonds */}
                {goal.milestones
                  .filter((m) => m.target_date)
                  .map((m) => {
                    const mx = dateToX(new Date(m.target_date!).getTime());
                    const my = y + BAR_HEIGHT / 2;
                    const ds = 5;
                    return (
                      <polygon
                        key={m.id}
                        points={`${mx},${my - ds} ${mx + ds},${my} ${mx},${my + ds} ${mx - ds},${my}`}
                        fill={m.completed ? color : "#fff"}
                        stroke={color}
                        strokeWidth={1.5}
                        opacity={0.9}
                      />
                    );
                  })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Goals without dates */}
      {goalsWithoutDates.length > 0 && (
        <div style={{ maxWidth: 1280, margin: "32px auto 0" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-ink-3, #8a8278)",
              marginBottom: 14,
            }}
          >
            Goals without dates
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {goalsWithoutDates.map((goal) => (
              <a
                key={goal.id}
                href={`/career/goals/${goal.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: "var(--color-bg-raised, #fff)",
                  border: `1px solid ${goal.color_tag ?? "var(--color-line, #e5e2da)"}`,
                  borderLeft: `4px solid ${goal.color_tag ?? "var(--color-accent)"}`,
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-ink-2, #423e37)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: goal.color_tag ?? "var(--color-accent)",
                    flexShrink: 0,
                  }}
                />
                {goal.title}
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-ink-4, #b8af9f)",
                    textTransform: "capitalize",
                  }}
                >
                  {goal.horizon}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FilterButton ──────────────────────────────────────────────────────────────

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 6,
        border: "1px solid",
        borderColor: active ? "var(--color-accent)" : "var(--color-line, #e5e2da)",
        background: active ? "var(--color-accent)" : "var(--color-bg-raised, #fff)",
        color: active ? "#fff" : "var(--color-ink-2, #423e37)",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
  );
}
