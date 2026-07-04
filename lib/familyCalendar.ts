// Family calendar: aggregates date-based events across the household for a
// given date range. Reuses the same visibility rules as the Phase 2b home
// timeline and /home/family page — own items, household-flagged items from
// circle members, items assigned to me, and (for child circle members)
// their course/assignment due dates.

import { createServiceClient } from "./supabase/server";

export interface CalendarEvent {
  id: string;
  date: string;          // YYYY-MM-DD (local)
  time: string | null;   // HH:MM 24h (local), null = all-day/due date only
  timeLabel: string;
  title: string;
  module: string;
  category: string;
  href?: string;
  person: string;        // "me" | member_user_id
  personLabel?: string;
}

interface CircleMember {
  id: string;
  role: string;
  label: string;
}

const MODULE_HREF: Record<string, string> = {
  hub: "/home", health: "/health", finance: "/finance/dashboard",
  investments: "/investments", "student-success": "/home/me/courses",
  career: "/career", bible: "/bible", children: "/children",
};

function localDateKey(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("sv", { timeZone: tz });
}

function localTimeLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sunday-start week containing `anchorDate` (YYYY-MM-DD). */
export function getWeekRange(anchorDate: string): { start: string; end: string } {
  const d = new Date(`${anchorDate}T12:00:00`);
  const start = addDays(anchorDate, -d.getDay());
  return { start, end: addDays(start, 6) };
}

/** Full Sunday-start weeks covering the calendar month containing `anchorDate`. */
export function getMonthGridRange(anchorDate: string): { start: string; end: string } {
  const [y, m] = anchorDate.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDayNum = new Date(y, m, 0).getDate();
  const lastOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
  const start = getWeekRange(firstOfMonth).start;
  const end = getWeekRange(lastOfMonth).end;
  return { start, end };
}

/**
 * Fetch every calendar-worthy event in [startDate, endDate] (inclusive,
 * YYYY-MM-DD strings in the household's local timezone) for this user and
 * their family circle.
 */
export async function getFamilyCalendarEvents(
  userId: string,
  startDate: string,
  endDate: string,
  tz: string
): Promise<{ events: CalendarEvent[]; members: CircleMember[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const rangeStartIso = `${startDate}T00:00:00`;
  const rangeEndIso = `${endDate}T23:59:59`;

  const { data: circleData } = await service
    .schema("hub")
    .from("family_members")
    .select("id, member_user_id, role, display_name, nickname")
    .eq("user_id", userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: CircleMember[] = ((circleData ?? []) as any[])
    .filter((m) => m.member_user_id)
    .map((m) => ({
      id: m.member_user_id as string,
      role: (m.role ?? "adult") as string,
      label: (m.display_name ?? m.nickname ?? "Member") as string,
    }));
  const memberIds = members.map((m) => m.id);
  const childIds = members.filter((m) => m.role === "child").map((m) => m.id);
  const memberLabel = (id: string) => members.find((m) => m.id === id)?.label;

  // hub.family_members.id (the stable anchor) for every child, whether or
  // not they have a login. Used to query hub.child_activities, which is
  // keyed on family_members.id rather than member_user_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childFamilyMemberIds = ((circleData ?? []) as any[])
    .filter((m) => m.role === "child")
    .map((m) => m.id as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childFamilyMemberMap = new Map<string, any>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((circleData ?? []) as any[]).filter((m) => m.role === "child").map((m) => [m.id as string, m])
  );

  const [
    myReminders,
    householdReminders,
    assignedReminders,
    myTodos,
    householdTodos,
    assignedTodos,
    careerGoals,
    workouts,
    myCourseReminders,
    childCourseReminders,
    childActivities,
  ] = await Promise.all([
    service.schema("hub").from("reminders")
      .select("id, title, due_at, category, source_app")
      .eq("user_id", userId).is("completed_at", null)
      .gte("due_at", rangeStartIso).lte("due_at", rangeEndIso),
    memberIds.length > 0
      ? service.schema("hub").from("reminders")
          .select("id, title, due_at, category, source_app, user_id")
          .eq("is_household", true).is("completed_at", null)
          .in("user_id", memberIds)
          .gte("due_at", rangeStartIso).lte("due_at", rangeEndIso)
      : Promise.resolve({ data: [] }),
    service.schema("hub").from("reminders")
      .select("id, title, due_at, category, source_app")
      .eq("assigned_to", userId).neq("user_id", userId).is("completed_at", null)
      .gte("due_at", rangeStartIso).lte("due_at", rangeEndIso),
    service.schema("hub").from("todos")
      .select("id, title, due_date")
      .eq("user_id", userId).eq("completed", false)
      .gte("due_date", startDate).lte("due_date", endDate),
    memberIds.length > 0
      ? service.schema("hub").from("todos")
          .select("id, title, due_date, user_id")
          .eq("is_household", true).eq("completed", false)
          .in("user_id", memberIds)
          .gte("due_date", startDate).lte("due_date", endDate)
      : Promise.resolve({ data: [] }),
    service.schema("hub").from("todos")
      .select("id, title, due_date")
      .eq("assigned_to", userId).neq("user_id", userId).eq("completed", false)
      .gte("due_date", startDate).lte("due_date", endDate),
    service.schema("career").from("career_goals")
      .select("id, title, target_date")
      .eq("user_id", userId).eq("status", "active")
      .gte("target_date", startDate).lte("target_date", endDate),
    service.from("scheduled_workouts")
      .select("id, label, scheduled_date, scheduled_time")
      .eq("user_id", userId)
      .gte("scheduled_date", startDate).lte("scheduled_date", endDate),
    service.schema("student_support").from("course_reminders")
      .select("id, type, title, due_date, due_time, courses:course_id (name)")
      .eq("user_id", userId).eq("is_completed", false)
      .gte("due_date", startDate).lte("due_date", endDate),
    childIds.length > 0
      ? service.schema("student_support").from("course_reminders")
          .select("id, type, title, due_date, due_time, user_id, courses:course_id (name)")
          .in("user_id", childIds).eq("is_completed", false)
          .gte("due_date", startDate).lte("due_date", endDate)
      : Promise.resolve({ data: [] }),
    childFamilyMemberIds.length > 0
      ? service.schema("hub").from("child_activities")
          .select("id, child_id, category, title, due_at")
          .in("child_id", childFamilyMemberIds).eq("completed", false)
          .gte("due_at", rangeStartIso).lte("due_at", rangeEndIso)
      : Promise.resolve({ data: [] }),
  ]);

  const events: CalendarEvent[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (myReminders.data ?? []) as any[]) {
    events.push({
      id: `rem-${r.id}`, date: localDateKey(r.due_at, tz), time: null,
      timeLabel: localTimeLabel(r.due_at, tz), title: r.title,
      module: r.source_app ?? "hub", category: r.category ?? "general",
      href: MODULE_HREF[r.source_app as string], person: "me",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (householdReminders.data ?? []) as any[]) {
    events.push({
      id: `hw-rem-${r.id}`, date: localDateKey(r.due_at, tz), time: null,
      timeLabel: localTimeLabel(r.due_at, tz), title: r.title,
      module: "family", category: r.category ?? "general",
      href: "/home/family", person: r.user_id, personLabel: memberLabel(r.user_id),
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (assignedReminders.data ?? []) as any[]) {
    events.push({
      id: `asn-rem-${r.id}`, date: localDateKey(r.due_at, tz), time: null,
      timeLabel: localTimeLabel(r.due_at, tz), title: `${r.title} — assigned to you`,
      module: "family", category: "appointment",
      href: "/home/family", person: "me",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (myTodos.data ?? []) as any[]) {
    events.push({
      id: `todo-${t.id}`, date: t.due_date, time: null, timeLabel: "Due",
      title: t.title, module: "hub", category: "todo", person: "me",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (householdTodos.data ?? []) as any[]) {
    events.push({
      id: `hw-todo-${t.id}`, date: t.due_date, time: null, timeLabel: "Due",
      title: t.title, module: "family", category: "todo",
      href: "/home/family", person: t.user_id, personLabel: memberLabel(t.user_id),
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (assignedTodos.data ?? []) as any[]) {
    events.push({
      id: `asn-todo-${t.id}`, date: t.due_date, time: null, timeLabel: "Due",
      title: `${t.title} — assigned to you`, module: "family", category: "todo", person: "me",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of (careerGoals.data ?? []) as any[]) {
    events.push({
      id: `career-${g.id}`, date: g.target_date, time: null, timeLabel: "Goal due",
      title: g.title, module: "career", category: "career",
      href: "/career/goals", person: "me",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const w of (workouts.data ?? []) as any[]) {
    events.push({
      id: `wkt-${w.id}`, date: w.scheduled_date,
      time: w.scheduled_time,
      timeLabel: w.scheduled_time
        ? new Date(`${w.scheduled_date}T${w.scheduled_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
        : "Workout",
      title: w.label || "Workout", module: "health", category: "workout",
      href: "/health/train", person: "me",
    });
  }
  const courseTimeLabel = (dueDate: string, dueTime: string | null) =>
    dueTime
      ? new Date(`${dueDate}T${dueTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
      : "Due";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (myCourseReminders.data ?? []) as any[]) {
    events.push({
      id: `course-${c.id}`, date: c.due_date, time: c.due_time,
      timeLabel: courseTimeLabel(c.due_date, c.due_time),
      title: c.courses?.name ? `${c.title} (${c.courses.name})` : c.title,
      module: "student-success", category: c.type ?? "general",
      href: "/home/me/courses", person: "me",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (childCourseReminders.data ?? []) as any[]) {
    events.push({
      id: `child-course-${c.id}`, date: c.due_date, time: c.due_time,
      timeLabel: courseTimeLabel(c.due_date, c.due_time),
      title: c.courses?.name ? `${c.title} (${c.courses.name})` : c.title,
      module: "student-success", category: c.type ?? "general",
      href: "/home/me/courses", person: c.user_id, personLabel: memberLabel(c.user_id),
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (childActivities.data ?? []) as any[]) {
    const childId = a.child_id as string;
    const childMember = childFamilyMemberMap.get(childId);
    // Managed children (no login) have no member_user_id, so there's no
    // auth user id to use as the person filter value. Fall back to the
    // family_members.id anchor itself — CalendarClient's person filter
    // chips are built from the same `members` list keyed the same way
    // for account-holding children, and this id is still unique/stable
    // per child, so it works as a filter key even without a real user.
    const personId: string = childMember?.member_user_id ?? childId;
    const personLabel: string | undefined = childMember?.display_name ?? childMember?.nickname ?? undefined;
    events.push({
      id: `child-act-${a.id}`,
      date: localDateKey(a.due_at, tz),
      time: null,
      timeLabel: localTimeLabel(a.due_at, tz),
      title: a.title,
      module: "children",
      category: a.category,
      href: `/children/${childId}`,
      person: personId,
      personLabel,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time < b.time ? -1 : 1;
  });

  return { events, members };
}
