"use client";

import { useState, useMemo } from "react";
import { findConflicts, type TimelineItem } from "./timelineConflicts";

export type { TimelineItem };

// ── Types ────────────────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  label: string;
}

interface Props {
  items: TimelineItem[];
  members: FamilyMember[]; // Phase 2: populated from family circle
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MODULE_DOT: Record<string, string> = {
  hub:              "var(--color-accent)",
  family:           "#E07B39",   // Phase 2b: assigned household tasks
  health:           "#4D6B3A",
  finance:          "#8B6A47",
  investments:      "#C97A3A",
  "student-success":"#6B5B95",
  children:         "#C97A9B",
  career:           "#2A6049",
  bible:            "#7B5EA7",
  appointment:      "var(--color-accent)",
  medication:       "#4D6B3A",
  workout:          "#C97A3A",
  bill:             "var(--color-amber)",
  todo:             "var(--color-ink-4)",
  general:          "var(--color-ink-3)",
  personal:         "var(--color-ink-3)",
};

export const MODULE_BADGE: Record<string, string> = {
  health:           "Health",
  finance:          "Finance",
  "student-success":"Courses",
  children:         "Children",
  career:           "Career",
  workout:          "Health",
  family:           "Family",  // Phase 2b: household tasks show "Family" badge
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FamilyTimeline({ items, members }: Props) {
  const [filter, setFilter] = useState<string>("everyone");

  const allChips: FamilyMember[] = [
    { id: "everyone", label: "Everyone" },
    { id: "me", label: "Me" },
    ...members,
  ];

  // Phase 2: filter by person. For now everyone = me.
  const filtered = useMemo(() => {
    if (filter === "everyone" || filter === "me") return items;
    return items.filter((i) => i.person === filter);
  }, [items, filter]);

  const conflicts = useMemo(() => findConflicts(filtered), [filtered]);

  if (items.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
          color: "var(--color-ink-4)",
          fontSize: 13,
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}
      >
        Nothing scheduled for today.
      </div>
    );
  }

  return (
    <div>
      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {allChips.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              aria-pressed={active}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                border: active
                  ? "1.5px solid var(--color-accent)"
                  : "1px solid var(--color-rule)",
                background: active ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                color: active ? "var(--color-accent)" : "var(--color-ink-3)",
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
                transition: "all 100ms",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Timeline rows */}
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        {filtered.map((item, idx) => {
          const hasConflict = conflicts.has(item.id);
          const dotColor =
            MODULE_DOT[item.category] ?? MODULE_DOT[item.module] ?? "var(--color-ink-3)";
          // For family household items, show the person's name as the badge
          const badge = item.personLabel ?? MODULE_BADGE[item.module] ?? MODULE_BADGE[item.category];

          const row = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 20px",
                borderBottom:
                  idx < filtered.length - 1
                    ? "1px solid var(--color-rule-soft)"
                    : "none",
                background: hasConflict
                  ? "rgba(184,138,46,0.04)"
                  : "transparent",
              }}
            >
              {/* Time */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-ink-4)",
                  minWidth: 60,
                  fontFamily: "var(--font-geist, system-ui), sans-serif",
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                }}
              >
                {item.timeLabel}
              </span>

              {/* Category dot */}
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: dotColor,
                  flexShrink: 0,
                }}
              />

              {/* Label */}
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-ink-2)",
                  fontFamily: "var(--font-geist, system-ui), sans-serif",
                  lineHeight: 1.4,
                  flex: 1,
                }}
              >
                {item.label}
              </span>

              {/* Conflict warning */}
              {hasConflict && (
                <span
                  aria-label="Schedule conflict"
                  title="This event overlaps with another within 30 minutes"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-amber)",
                    flexShrink: 0,
                  }}
                >
                  Conflict
                </span>
              )}

              {/* Module badge */}
              {badge && !hasConflict && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: dotColor,
                    flexShrink: 0,
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
          );

          return item.href ? (
            <a
              key={item.id}
              href={item.href}
              style={{ display: "block", textDecoration: "none" }}
            >
              {row}
            </a>
          ) : (
            <div key={item.id}>{row}</div>
          );
        })}
      </div>
    </div>
  );
}
