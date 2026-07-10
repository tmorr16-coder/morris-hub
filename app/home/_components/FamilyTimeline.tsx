"use client";

import { useState, useMemo } from "react";
import { Chip } from "@/components/ios";
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
  hub:              "var(--ios-tint)",
  family:           "#E07B39",   // Phase 2b: assigned household tasks
  health:           "#4D6B3A",
  finance:          "#8B6A47",
  investments:      "#C97A3A",
  "student-success":"#6B5B95",
  children:         "#C97A9B",
  career:           "#2A6049",
  bible:            "#7B5EA7",
  appointment:      "var(--ios-tint)",
  medication:       "#4D6B3A",
  workout:          "#C97A3A",
  bill:             "var(--ios-orange)",
  todo:             "var(--ios-label-3)",
  general:          "var(--ios-label-2)",
  personal:         "var(--ios-label-2)",
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
      <div style={{
        background: "var(--ios-cell)",
        borderRadius: "var(--ios-radius-card)",
        padding: "20px 16px",
        color: "var(--ios-label-2)",
      }} className="ios-subhead">
        Nothing scheduled for today.
      </div>
    );
  }

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {allChips.map((chip) => (
          <Chip key={chip.id} small selected={filter === chip.id} onClick={() => setFilter(chip.id)}>
            {chip.label}
          </Chip>
        ))}
      </div>

      {/* Timeline rows */}
      <div className="ios-list" style={{ margin: 0 }}>
        {filtered.map((item) => {
          const hasConflict = conflicts.has(item.id);
          const dotColor =
            MODULE_DOT[item.category] ?? MODULE_DOT[item.module] ?? "var(--ios-label-2)";
          // For family household items, show the person's name as the badge
          const badge = item.personLabel ?? MODULE_BADGE[item.module] ?? MODULE_BADGE[item.category];

          const inner = (
            <>
              {/* Time */}
              <span className="ios-cell-lead ios-caption ios-num" style={{ color: "var(--ios-label-2)", minWidth: 58, justifyContent: "flex-start" }}>
                {item.timeLabel}
              </span>

              {/* Category dot */}
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />

              {/* Label */}
              <span className="ios-cell-body">
                <span className="ios-cell-title ios-subhead">{item.label}</span>
              </span>

              {/* Conflict warning */}
              {hasConflict && (
                <span
                  aria-label="Schedule conflict"
                  title="This event overlaps with another within 30 minutes"
                  className="ios-caption"
                  style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ios-orange)", flexShrink: 0 }}
                >
                  Conflict
                </span>
              )}

              {/* Module badge */}
              {badge && !hasConflict && (
                <span
                  className="ios-caption"
                  style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: dotColor, flexShrink: 0 }}
                >
                  {badge}
                </span>
              )}
            </>
          );

          return item.href ? (
            <a key={item.id} href={item.href} className="ios-cell">{inner}</a>
          ) : (
            <div key={item.id} className="ios-cell">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
