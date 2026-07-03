"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Group, Cell, IconBadge, Chip, Icons } from "@/components/ios";

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

const HORIZONS = ["short-term", "medium-term", "long-term"] as const;
const HORIZON_LABELS: Record<string, string> = {
  "short-term": "Short-term",
  "medium-term": "Medium-term",
  "long-term": "Long-term",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function progressColor(pct: number): string {
  if (pct >= 100) return "var(--ios-green)";
  if (pct >= 50) return "var(--ios-tint)";
  return "var(--ios-orange)";
}

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

  // ── Group filtered goals into horizon lanes ───────────────────────────────
  const grouped = useMemo(() => {
    return HORIZONS.map((horizon) => ({
      horizon,
      goals: filteredGoals.filter((g) => g.horizon === horizon),
    }));
  }, [filteredGoals]);

  const otherGoals = useMemo(
    () => filteredGoals.filter((g) => !HORIZONS.includes(g.horizon as (typeof HORIZONS)[number])),
    [filteredGoals]
  );

  // ── Goal → Cell ───────────────────────────────────────────────────────────
  function renderGoalCell(goal: Goal) {
    const pct = Math.min(100, Math.max(0, goal.progress_pct ?? 0));
    const dated = goal.milestones.filter((m) => m.target_date);
    const doneCount = goal.milestones.filter((m) => m.completed).length;
    const total = goal.milestones.length;

    const dateStr = goal.target_date
      ? `Target ${fmtDate(goal.target_date)}`
      : goal.start_date
      ? `Started ${fmtDate(goal.start_date)}`
      : "No target date";
    const milestoneStr = total > 0 ? `${doneCount}/${total} milestones` : null;
    const subtitle = [dateStr, milestoneStr].filter(Boolean).join(" · ");

    return (
      <Cell
        key={goal.id}
        lead={
          <IconBadge color={goal.color_tag ?? "var(--ios-tint)"}>
            <Icons.BriefcaseIcon />
          </IconBadge>
        }
        title={goal.title}
        subtitle={
          <span style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 2 }}>
            <span>{subtitle}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--ios-fill)", overflow: "hidden" }}>
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 3,
                    background: progressColor(pct),
                  }}
                />
              </span>
              {dated.length > 0 && (
                <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                  {dated.length} dated
                </span>
              )}
            </span>
          </span>
        }
        trailing={
          <span className="ios-num ios-subhead" style={{ fontWeight: 600, color: progressColor(pct) }}>
            {pct}%
          </span>
        }
        onClick={() => router.push(`/career/goals/${goal.id}`)}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Horizon filter */}
      <div className="ios-group-header" style={{ padding: "12px 16px 8px" }}>Horizon</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 16px" }}>
        {(["all", "short-term", "medium-term", "long-term"] as const).map((h) => (
          <Chip key={h} small selected={horizonFilter === h} onClick={() => setHorizonFilter(h)}>
            {h === "all" ? "All" : HORIZON_LABELS[h]}
          </Chip>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "16px 16px 8px" }}>Category</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 16px" }}>
            <Chip small selected={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
              All
            </Chip>
            {categories.map((c) => (
              <Chip key={c} small selected={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </>
      )}

      {/* Grouped lists per horizon */}
      {grouped.map(({ horizon, goals: laneGoals }) =>
        laneGoals.length === 0 ? null : (
          <Group key={horizon} header={`${HORIZON_LABELS[horizon]} · ${laneGoals.length}`}>
            {laneGoals.map(renderGoalCell)}
          </Group>
        )
      )}

      {/* Goals with an unrecognized horizon */}
      {otherGoals.length > 0 && (
        <Group header={`Other · ${otherGoals.length}`}>{otherGoals.map(renderGoalCell)}</Group>
      )}

      {/* Empty state */}
      {filteredGoals.length === 0 && (
        <Group>
          <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)" }}>
            No goals match these filters
          </div>
        </Group>
      )}
    </div>
  );
}
