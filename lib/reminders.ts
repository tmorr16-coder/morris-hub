// Cross-platform reminders. The same `hub.reminders` table is used by
// all three apps. Recurrence is computed at read-time — when a recurring
// reminder is past-due and completed, we roll the due_at forward.

import { createServiceClient } from "./supabase/server";

export type Recurrence = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
export type Category = "bill" | "medication" | "workout" | "appointment" | "personal" | "general";
export type SourceApp = "hub" | "health" | "finance";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_at: string;
  recurrence: Recurrence;
  category: Category;
  source_app: SourceApp;
  completed_at: string | null;
  snooze_until: string | null;
  next_steps?: string[] | null;
}

const RECURRENCE_DAYS: Record<Recurrence, number | null> = {
  once: null,
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Fetch upcoming reminders for a user. Auto-rolls recurring reminders that
 * have passed their due_at into the next cycle (idempotent on read).
 */
export async function getUpcomingReminders(
  userId: string,
  daysAhead = 30
): Promise<Reminder[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const horizon = new Date(Date.now() + daysAhead * 86_400_000).toISOString();

  const { data } = await service
    .schema("hub")
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .is("completed_at", null)
    .lte("due_at", horizon)
    .order("due_at", { ascending: true });

  let reminders = (data ?? []) as Reminder[];
  const now = Date.now();

  // Roll forward overdue recurring reminders
  for (const r of reminders) {
    if (r.recurrence === "once") continue;
    const daysGap = RECURRENCE_DAYS[r.recurrence];
    if (!daysGap) continue;
    if (new Date(r.due_at).getTime() >= now) continue;

    let next = r.due_at;
    while (new Date(next).getTime() < now) {
      next = addDays(next, daysGap);
    }
    // Patch in DB
    await service
      .schema("hub")
      .from("reminders")
      .update({ due_at: next, last_triggered_at: new Date().toISOString() })
      .eq("id", r.id);
    r.due_at = next;
  }

  // Re-sort after roll-forward
  reminders.sort((a, b) => (a.due_at < b.due_at ? -1 : 1));
  return reminders;
}

export function formatDueLabel(dueAtIso: string, tz: string): string {
  const due = new Date(dueAtIso);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 0) {
    const absMin = Math.abs(diffMin);
    if (absMin < 60) return `${absMin}m overdue`;
    const hrs = Math.round(absMin / 60);
    if (hrs < 24) return `${hrs}h overdue`;
    return `${Math.round(hrs / 24)}d overdue`;
  }
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  }
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return `tomorrow ${due.toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz })}`;
  if (diffDay < 7) {
    return due.toLocaleDateString("en-US", { weekday: "short", timeZone: tz }) + " " +
           due.toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz });
  }
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
}
