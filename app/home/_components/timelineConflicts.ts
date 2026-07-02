// Plain (non-"use client") module so findConflicts can be called from both
// the FamilyTimeline client component and server components like
// app/home/page.tsx — a "use client" module's exports aren't callable
// from server code, only renderable as components.

export interface TimelineItem {
  id: string;
  sortKey: string;       // ISO timestamp for sorting; "T99:99" suffix = all-day/due-today
  timeLabel: string;     // "2:00 PM" | "Due today"
  label: string;
  module: string;        // "hub" | "health" | "finance" | "student-success" | "career"
  category: string;
  href?: string;
  person?: string;       // "me" | family member_user_id (Phase 2b)
  personLabel?: string;  // display name for the person (e.g. "Alicia")
}

// Conflict: two timed events within 30 minutes of each other
export function findConflicts(items: TimelineItem[]): Set<string> {
  const conflicting = new Set<string>();
  const timed = items.filter((i) => !i.sortKey.includes("T99:99"));

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = new Date(timed[i].sortKey).getTime();
      const b = new Date(timed[j].sortKey).getTime();
      if (Math.abs(b - a) < 30 * 60 * 1000) {
        conflicting.add(timed[i].id);
        conflicting.add(timed[j].id);
      }
    }
  }
  return conflicting;
}
