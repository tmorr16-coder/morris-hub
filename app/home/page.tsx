export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAllUpcomingReminders, getAssignedReminders } from "@/lib/reminders";
import { findConflicts, type TimelineItem } from "./_components/timelineConflicts";
import { getFamilyCalendarEvents } from "@/lib/familyCalendar";
import type { Todo } from "./actions";
import { Suspense } from "react";
import { getPreferences } from "@/lib/prefs";
import { getUserTimezone } from "@/lib/timezone";
import HomeClient from "./HomeClient";
import QuickActions from "./_components/QuickActions";
import SetupChecklist, { type SetupItem } from "./_components/SetupChecklist";
import TodayMarkets from "./_components/TodayMarkets";
import TodayNews from "./_components/TodayNews";
import MoneyGlanceValue from "./_components/MoneyGlanceValue";
import { TodayWeatherValue, TodayWeatherSub } from "./_components/TodayWeatherGlance";
import { unstable_cache } from "next/cache";

/**
 * Display names for family-circle members, cached for five minutes.
 *
 * This is a Supabase *admin* call listing every user, and it ran on every
 * single render of the Today screen — the first thing the app opens — purely to
 * turn member ids into names. Names change roughly never, so paying an admin
 * round-trip for them on each load was the wrong trade. Cached across requests,
 * not just deduped within one.
 */
const cachedMemberNames = unstable_cache(
  async (): Promise<[string, string][]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = createServiceClient() as any;
    const { data } = await svc.auth.admin.listUsers({ perPage: 200 });
    const out: [string, string][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (data?.users ?? []) as any[]) {
      const nm = u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? null;
      if (nm) out.push([u.id as string, nm as string]);
    }
    return out;
  },
  ["home-member-names"],
  { revalidate: 300 },
);

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Gate: redirect new users to onboarding.
  // NOTE: redirect() throws NEXT_REDIRECT, so it must run OUTSIDE the try/catch —
  // otherwise the catch swallows the redirect and it silently never happens.
  let needsOnboarding = false;
  try {
    const { data: onboardingCheck } = await service
      .schema("hub")
      .from("preferences")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    needsOnboarding = onboardingCheck?.onboarding_completed === false;
  } catch {
    // Column doesn't exist yet — skip
  }
  if (needsOnboarding) redirect("/onboarding");

  // Compute early so workouts query can filter by today's date
  const userTz = getUserTimezone(user.user_metadata);
  const today = new Date();
  const todayStr = today.toLocaleDateString("sv", { timeZone: userTz }); // YYYY-MM-DD

  const [todoResult, reminders, workoutsResult, assignedReminders, circleResult] = await Promise.all([
    service
      .schema("hub")
      .from("todos")
      .select("id, title, completed, notes, due_date, priority, created_at")
      .eq("user_id", user.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
    getAllUpcomingReminders(user.id),
    service
      .from("scheduled_workouts")
      .select("id, label, scheduled_time")
      .eq("user_id", user.id)
      .eq("scheduled_date", todayStr)
      .order("scheduled_time", { ascending: true, nullsFirst: false }),
    // Reminders assigned to this user by family members (Phase 2b)
    getAssignedReminders(user.id),
    // Family circle members for FamilyTimeline filter chips
    service.schema("hub").from("family_members")
      .select("member_user_id, display_name, nickname, role")
      .eq("user_id", user.id),
  ]);

  const todos = (todoResult.data ?? []) as Todo[];

  // Family circle members for FamilyTimeline filter chips + household reminders.
  // Resolve names the same way the Family page does: display_name/nickname, then
  // the member's auth full name — otherwise account-holders with no nickname set
  // (e.g. Maya, Alicia) render as a generic "Member" on Today.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCircle = (circleResult.data ?? []) as any[];
  const circleAuthIds = rawCircle.map((m) => m.member_user_id).filter(Boolean) as string[];
  const circleNames = new Map<string, string>();
  if (circleAuthIds.length > 0) {
    try {
      for (const [id, nm] of await cachedMemberNames()) circleNames.set(id, nm);
    } catch { /* auth admin unavailable — fall back to "Member" */ }
  }
  const circleMembers = rawCircle.map((m) => ({
    id: m.member_user_id as string,
    label: (m.display_name ?? m.nickname ?? (m.member_user_id ? circleNames.get(m.member_user_id) : null) ?? "Member") as string,
    role: (m.role ?? "adult") as string,
  }));
  const memberIds = circleMembers.map((m) => m.id);
  const childMemberIds = circleMembers.filter((m) => m.role === "child").map((m) => m.id);

  // Fetch household reminders from circle members, overdue/due-soon course
  // reminders (mine + children's), missed workouts, and unowned household
  // items — all needed for the Needs Attention and Family Status sections.
  const dueSoonHorizon = new Date(today.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const overdueHorizon = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [hwResult, courseResult, missedWorkoutsResult, unownedRemindersResult, unownedTodosResult] = await Promise.all([
    memberIds.length > 0
      ? service.schema("hub").from("reminders")
          .select("id, title, due_at, category, source_app, user_id, assigned_to")
          .eq("is_household", true).is("completed_at", null)
          .in("user_id", memberIds)
          .lte("due_at", new Date(today.getTime() + 7 * 86_400_000).toISOString())
          .order("due_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    service.schema("student_support").from("course_reminders")
      .select("id, type, title, due_date, user_id, courses:course_id(name)")
      .in("user_id", [user.id, ...childMemberIds])
      .eq("is_completed", false)
      .gte("due_date", overdueHorizon).lte("due_date", dueSoonHorizon)
      .order("due_date", { ascending: true }),
    service.from("scheduled_workouts")
      .select("id, label, scheduled_date")
      .eq("user_id", user.id).eq("completed", false)
      .lt("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: false })
      .limit(3),
    service.schema("hub").from("reminders")
      .select("id, title, due_at, category")
      .eq("is_household", true).is("assigned_to", null).is("completed_at", null)
      .in("user_id", [user.id, ...memberIds])
      .order("due_at", { ascending: true }).limit(3),
    service.schema("hub").from("todos")
      .select("id, title, due_date")
      .eq("is_household", true).is("assigned_to", null).eq("completed", false)
      .in("user_id", [user.id, ...memberIds])
      .order("due_date", { ascending: true }).limit(3),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familyHouseholdReminders = (hwResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courseAttentionItems = (courseResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missedWorkouts = (missedWorkoutsResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unownedReminders = (unownedRemindersResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unownedTodos = (unownedTodosResult.data ?? []) as any[];
  const circleLabel = (id: string) => (id === user.id ? "You" : circleMembers.find((m) => m.id === id)?.label ?? "Family");

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];
  const localHour = parseInt(
    today.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }),
    10
  );
  const greeting = (() => {
    if (localHour < 5) return "Good evening";
    if (localHour < 12) return "Good morning";
    if (localHour < 17) return "Good afternoon";
    return "Good evening";
  })();
  const todayDisplay = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: userTz,
  });
  // todayStr already computed above before queries

  // Declare early — used in Needs Attention, My Priorities, and timeline
  const scheduledWorkouts = (workoutsResult.data ?? []) as { id: string; label: string; scheduled_time: string | null }[];

  // ── Needs Attention — structured items with severity, context, actions ──────
  const overdueTodos = todos.filter(
    (t) => !t.completed && t.due_date && t.due_date < todayStr
  );
  const urgentTodos = todos.filter(
    (t) => !t.completed && t.priority === "high" && (!t.due_date || t.due_date >= todayStr)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueReminders = (reminders as any[]).filter((r) => {
    if (r.completed_at) return false;
    const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
    return localDate < todayStr;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billsDueToday = (reminders as any[]).filter((r) => {
    if (r.completed_at) return false;
    const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
    return localDate === todayStr && r.category === "bill";
  });

  // Today's plan timeline items — built here (before attentionItems) so
  // schedule conflicts can be detected and surfaced as an attention item.
  const todayDueTodos = todos.filter((t) => !t.completed && t.due_date === todayStr);

  const timelineItems: TimelineItem[] = [
    // Reminders (cross-module via source_app: hub, health, finance, student-success, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(reminders as any[])
      .filter((r) => {
        const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
        return localDate === todayStr;
      })
      .map((r) => ({
        id: `rem-${r.id}`,
        sortKey: r.due_at,
        timeLabel: new Date(r.due_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz }),
        label: r.title,
        module: (r.source_app ?? "hub") as string,
        category: (r.category ?? "general") as string,
        href: MODULE_HREF[r.source_app as string],
      })),
    // Scheduled workouts from the health module
    ...scheduledWorkouts.map((w) => ({
      id: `wkt-${w.id}`,
      sortKey: w.scheduled_time ? `${todayStr}T${w.scheduled_time}` : `${todayStr}T23:00`,
      timeLabel: w.scheduled_time
        ? new Date(`${todayStr}T${w.scheduled_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz })
        : "Today",
      label: w.label || "Workout",
      module: "health",
      category: "workout",
      href: "/health/train",
    })),
    // Todos due today (no specific time — rendered after timed items)
    ...todayDueTodos.map((t) => ({
      id: `todo-${t.id}`,
      sortKey: `${todayStr}T99:99`,
      timeLabel: "Due today",
      label: t.title,
      module: "hub",
      category: "todo",
      href: undefined,
    })),
    // Reminders assigned to this user by family members (Phase 2b)
    ...assignedReminders
      .filter((r) => {
        const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
        return localDate === todayStr;
      })
      .map((r) => ({
        id: `assigned-${r.id}`,
        sortKey: r.due_at,
        timeLabel: new Date(r.due_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz }),
        label: `${r.title} — assigned to you`,
        module: "family",
        category: "appointment",
        href: "/home/family",
        person: "me",
      })),
    // Household reminders from family circle members (visible via Phase 2b RLS)
    ...familyHouseholdReminders
      .filter((r) => {
        const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
        return localDate === todayStr;
      })
      .map((r) => {
        const owner = circleMembers.find((m) => m.id === r.user_id);
        return {
          id: `family-hw-${r.id}`,
          sortKey: r.due_at,
          timeLabel: new Date(r.due_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz }),
          label: r.title,
          module: "family",
          category: r.category ?? "general",
          href: "/home/family",
          person: r.user_id as string,   // filter chip uses member_user_id
          personLabel: owner?.label,
        };
      }),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const todayConflicts = findConflicts(timelineItems);

  type ItemKind = "reminder" | "course_reminder" | "todo" | "workout" | "conflict" | "other";
  interface AttentionItem {
    id: string;
    severity: "Urgent" | "Today" | "This week" | "Informational";
    title: string;
    context: string;
    who: string;
    person?: string;
    kind: ItemKind;
    actionId: string;
    primaryAction: { label: string; href: string };
    secondaryAction?: { label: string; href: string };
  }

  function fmtDueDate(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const CATEGORY_CONTEXT: Record<string, string> = {
    bill: "Bill", medication: "Medication", appointment: "Appointment",
    workout: "Workout", personal: "Personal", general: "Reminder",
  };
  const MODULE_ACTION_HREF: Record<string, string> = {
    health: "/health", finance: "/finance/dashboard",
    investments: "/investments", "student-success": "/home/me/courses",
    career: "/career", bible: "/bible", hub: "/home",
  };
  const COURSE_TYPE_LABEL: Record<string, string> = {
    test: "Test", assignment: "Assignment", quiz: "Quiz",
    practice: "Practice", extra_credit: "Extra credit",
  };

  const sortedAttentionItems: AttentionItem[] = [
    // Schedule conflicts — overlapping events within 30 minutes today
    ...(todayConflicts.size > 0 ? [{
      id: "conflict-today",
      severity: "Today" as const,
      title: "You have overlapping events today",
      context: `${todayConflicts.size} events overlap within 30 minutes of each other`,
      who: "You",
      person: "me",
      kind: "conflict" as const,
      actionId: "",
      primaryAction: { label: "View today's plan", href: "#today-plan-heading" },
    }] : []),
    // Overdue/due-soon assignments (mine + children's) — also stands in for "required forms"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...courseAttentionItems.slice(0, 2).map((c: any) => {
      const isMine = c.user_id === user.id;
      const childName = isMine ? null : circleLabel(c.user_id);
      const isOverdue = c.due_date < todayStr;
      return {
        id: `course-${c.id}`,
        severity: (isOverdue ? "Today" : "This week") as "Today" | "This week",
        title: `${childName ? `${childName}’s` : "Your"} ${c.courses?.name ? `${c.courses.name} ` : ""}${(COURSE_TYPE_LABEL[c.type] ?? "assignment").toLowerCase()}`,
        context: `${COURSE_TYPE_LABEL[c.type] ?? "Assignment"} · ${isOverdue ? "was due" : "due"} ${fmtDueDate(c.due_date)}`,
        who: childName ?? "You",
        person: (isMine ? "me" : c.user_id) as string,
        // Only the user's own course reminders can be completed via RLS.
        kind: (isMine ? "course_reminder" : "other") as ItemKind,
        actionId: c.id as string,
        primaryAction: { label: "Review", href: "/home/me/courses" },
      };
    }),
    // Missed health commitments — past scheduled workouts never completed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...missedWorkouts.slice(0, 2).map((w: any) => ({
      id: `missed-workout-${w.id}`,
      severity: "Urgent" as const,
      title: `Missed ${w.label || "workout"}`,
      context: `Workout · was scheduled ${fmtDueDate(w.scheduled_date)}`,
      who: "You",
      person: "me",
      kind: "workout" as const,
      actionId: w.id as string,
      primaryAction: { label: "View", href: "/health/train" },
    })),
    // Responsibilities without an owner — household items nobody has claimed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...[...unownedReminders, ...unownedTodos].slice(0, 2).map((item: any) => ({
      id: `unowned-${item.id}`,
      severity: "This week" as const,
      title: item.title,
      context: `Household ${CATEGORY_CONTEXT[item.category] ?? "task"} · not yet assigned to anyone`,
      who: "Family",
      // Household items may belong to another member — keep as a link-only "Assign".
      kind: "other" as const,
      actionId: item.id as string,
      primaryAction: { label: "Assign", href: "/home/family" },
    })),
    // Overdue todos → Urgent
    ...overdueTodos.slice(0, 2).map((t) => ({
      id: `t-overdue-${t.id}`,
      severity: "Urgent" as const,
      title: t.title,
      context: `Overdue task · was due ${fmtDueDate(t.due_date!)}`,
      who: "You",
      kind: "todo" as const,
      actionId: t.id,
      primaryAction: { label: "Open task", href: "/home/tasks" },
    })),
    // Bills due today → Today
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...billsDueToday.slice(0, 2).map((r: any) => ({
      id: `r-bill-${r.id}`,
      severity: "Today" as const,
      title: r.title,
      context: `Payment due today · ${new Date(r.due_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz })}`,
      who: "You",
      kind: "reminder" as const,
      actionId: r.id as string,
      primaryAction: { label: "View finances", href: "/finance/dashboard" },
    })),
    // Overdue reminders → Today/Urgent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...overdueReminders.slice(0, 2).map((r: any) => ({
      id: `r-overdue-${r.id}`,
      severity: "Today" as const,
      title: r.title,
      context: `${CATEGORY_CONTEXT[r.category] ?? "Reminder"} · was due ${fmtDueDate(new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz }))}`,
      who: "You",
      kind: "reminder" as const,
      actionId: r.id as string,
      primaryAction: { label: "View", href: MODULE_ACTION_HREF[r.source_app as string] ?? "/home/tasks" },
    })),
    // High-priority todos → Today or This week
    ...urgentTodos.slice(0, 1).map((t) => ({
      id: `t-urgent-${t.id}`,
      severity: (t.due_date === todayStr ? "Today" : "This week") as "Today" | "This week",
      title: t.title,
      context: `High priority${t.due_date ? ` · due ${fmtDueDate(t.due_date)}` : ""}`,
      who: "You",
      kind: "todo" as const,
      actionId: t.id,
      primaryAction: { label: "Open task", href: "/home/tasks" },
    })),
  ].sort((a, b) => {
    const ord: Record<string, number> = { Urgent: 0, Today: 1, "This week": 2, Informational: 3 };
    return ord[a.severity] - ord[b.severity];
  });

  // Personal mode only ever shows items that concern you — not household-wide
  // or other family members' items.

  // ── My Priorities — four categories, one item each ──────────────────────────

  // ── Family Status — one compact row per family member ───────────────────────
  const weekEndStr = new Date(today.getTime() + 6 * 86_400_000).toLocaleDateString("sv", { timeZone: userTz });
  const { events: familyStatusEvents } = await getFamilyCalendarEvents(user.id, todayStr, weekEndStr, userTz);
  const eventsByPerson = new Map<string, typeof familyStatusEvents>();
  for (const e of familyStatusEvents) {
    if (!eventsByPerson.has(e.person)) eventsByPerson.set(e.person, []);
    eventsByPerson.get(e.person)!.push(e);
  }
  function relDateLabel(dateStr: string): string {
    if (dateStr === todayStr) return "today";
    const tomorrowStr = new Date(today.getTime() + 86_400_000).toLocaleDateString("sv", { timeZone: userTz });
    if (dateStr === tomorrowStr) return "tomorrow";
    return fmtDueDate(dateStr);
  }
  const familyStatusRows = [{ id: "me", label: firstName }, ...circleMembers].map((m) => {
    const events = (eventsByPerson.get(m.id) ?? []).slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time < b.time ? -1 : 1;
    });
    const next = events[0];
    const second = events[1];
    return {
      id: m.id,
      name: m.label,
      nextEvent: next
        ? { title: next.title, timeLabel: `${relDateLabel(next.date)}${next.time ? ` ${next.timeLabel}` : ""}`, href: next.href }
        : null,
      status: second ? `${second.title} ${relDateLabel(second.date)}` : null,
      hasAttention: sortedAttentionItems.some((a) => a.person === m.id),
    };
  });




  // ══ iOS-native Today hub — maps this page's real data into TodayHubIOS ═══════
  const iosSev = (s: string): "urgent" | "today" | "week" =>
    s === "Urgent" ? "urgent" : s === "Today" ? "today" : "week";
  const attnCat = (href: string): string =>
    href.includes("/health") ? "workout"
    : href.includes("/finance") ? "bill"
    : href.includes("/courses") ? "course"
    : href.includes("/family") ? "family"
    : "general";
  const iosAttention = sortedAttentionItems.slice(0, 6).map((a) => ({
    id: a.id, severity: iosSev(a.severity), title: a.title,
    context: a.context, category: attnCat(a.primaryAction.href), href: a.primaryAction.href,
    kind: a.kind, actionId: a.actionId,
  }));
  // Derive the actionable kind + underlying row id from the timeline item id prefix.
  // (rem-/assigned-/family-hw- → hub.reminders; todo- → hub.todos; wkt- → workout.)
  const tlKind = (id: string): ItemKind =>
    id.startsWith("todo-") ? "todo"
    : id.startsWith("wkt-") ? "workout"
    : (id.startsWith("rem-") || id.startsWith("assigned-") || id.startsWith("family-hw-")) ? "reminder"
    : "other";
  const tlActionId = (id: string): string => id.replace(/^(rem-|assigned-|family-hw-|todo-|wkt-)/, "");
  const iosTimeline = timelineItems.map((t) => ({
    id: t.id, time: t.timeLabel, label: t.label, category: t.category,
    kind: tlKind(t.id), actionId: tlActionId(t.id), href: t.href,
  }));
  const iosPriorities = [
    ...todos.filter((t) => !t.completed).map((t) => ({ id: t.id, title: t.title, done: false, flag: t.priority === "high" ? "High priority" : undefined })),
    ...todos.filter((t) => t.completed).slice(0, 2).map((t) => ({ id: t.id, title: t.title, done: true, flag: undefined as string | undefined })),
  ];
  const IOS_FAM_COLORS = ["var(--ios-tint)", "#B565A7", "#E8607A", "#34A56F", "#C97A3A", "#5E5CE6"];
  const iosFamily = familyStatusRows.map((r, i) => ({
    id: r.id,
    name: r.id === "me" ? `${r.name} (you)` : r.name,
    status: r.nextEvent ? `${r.nextEvent.title} · ${r.nextEvent.timeLabel}` : (r.status ?? "All clear"),
    color: IOS_FAM_COLORS[i % IOS_FAM_COLORS.length],
    initial: (r.name?.[0] ?? "?").toUpperCase(),
    href: r.id === "me" ? "/home/me" : "/home/family",
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosUpcoming = (reminders as any[]).filter((r) => !r.completed_at);
  // Health + Money glance — light lookups (steps today, latest net-worth snapshot)
  const homeTz = getUserTimezone(user.user_metadata);
  const homeTodayKey = new Intl.DateTimeFormat("en-CA", { timeZone: homeTz }).format(new Date());
  const [stepsRes, netRes] = await Promise.all([
    service.from("apple_health_metrics")
      .select("value, source, timestamp")
      .eq("user_id", user.id)
      .in("metric_name", ["step_count", "steps", "Step Count", "Steps"])
      .gte("timestamp", new Date(new Date().getTime() - 7 * 86_400_000).toISOString()),
    service.schema("finance").from("net_position_snapshots")
      .select("net_position, captured_at").eq("user_id", user.id)
      .order("captured_at", { ascending: false }).limit(30),
  ]);
  // Most recent day with step data — Apple (Watch) preferred per day, Oura the
  // fallback; today if present, else the latest available day (labeled).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepRows = (stepsRes.data ?? []) as any[];
  const homeTzFmt = new Intl.DateTimeFormat("en-CA", { timeZone: homeTz });
  const stepByDay = new Map<string, { apple: number; oura: number; hasApple: boolean; hasOura: boolean }>();
  for (const r of stepRows) {
    // Oura stores a daily summary at UTC-midnight (use its date); Apple stores
    // instantaneous UTC timestamps (convert to the user's tz).
    const day = r.source === "oura" ? String(r.timestamp ?? "").slice(0, 10) : homeTzFmt.format(new Date(r.timestamp ?? 0));
    if (!day) continue;
    const d = stepByDay.get(day) ?? { apple: 0, oura: 0, hasApple: false, hasOura: false };
    if (r.source === "oura") { d.oura += Number(r.value) || 0; d.hasOura = true; }
    else { d.apple += Number(r.value) || 0; d.hasApple = true; }
    stepByDay.set(day, d);
  }
  let stepsToday = 0; let stepsDayKey: string | null = null;
  for (const day of [...stepByDay.keys()].sort().reverse()) {
    const d = stepByDay.get(day)!;
    if (d.hasApple) { stepsToday = d.apple; stepsDayKey = day; break; }
    if (d.hasOura) { stepsToday = d.oura; stepsDayKey = day; break; }
  }
  const stepsIsToday = stepsDayKey === homeTodayKey;
  const stepsDayShort = stepsDayKey ? new Date(`${stepsDayKey}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
  const netSnaps = (netRes.data ?? []) as { net_position?: number }[];
  const netWorth: number | null = netSnaps[0]?.net_position ?? null;
  // % change vs the oldest snapshot in the window. The Today glance shows only
  // this METRIC — never the actual balance, since it's a very glanceable spot.
  const netPrev: number | null = netSnaps.length > 1 ? (netSnaps[netSnaps.length - 1]?.net_position ?? null) : null;
  const netPct: number | null = netWorth != null && netPrev != null && netPrev !== 0
    ? ((netWorth - netPrev) / Math.abs(netPrev)) * 100 : null;

  // Preferences and the finance PIN are independent reads — awaiting them one
  // after the other just added a round-trip to the critical path.
  const [homePrefs, financeLocked] = await Promise.all([
    getPreferences(user.id).catch(() => null),
    // When a finance PIN is set, the money glance must not reveal anything (even
    // the trend %) in the clear — mirror the PIN that guards the finance section.
    (async () => {
      try {
        const { data: financePinRow } = await service
          .schema("hub")
          .from("preferences")
          .select("finance_pin")
          .eq("user_id", user.id)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return !!((financePinRow as any)?.finance_pin);
      } catch {
        return false; // finance_pin column not present / query failed — leave unlocked
      }
    })(),
  ]);

  // Weather leads the glance (replacing the calendar tile). The forecast is NOT
  // awaited here — it streams in via <Suspense> so two calls to api.weather.gov
  // can't hold up the whole home screen. We only need the saved coordinates to
  // know whether the tile belongs on the grid at all.
  const hasLocation = homePrefs?.latitude != null && homePrefs?.longitude != null;

  const iosGlance = {
    ...(hasLocation
      ? {
          weather: {
            value: (
              <Suspense fallback={<span className="ios-tile-pending">—</span>}>
                <TodayWeatherValue lat={homePrefs!.latitude!} lon={homePrefs!.longitude!} />
              </Suspense>
            ),
            sub: (
              <Suspense fallback={<span className="ios-tile-pending">Loading…</span>}>
                <TodayWeatherSub lat={homePrefs!.latitude!} lon={homePrefs!.longitude!} />
              </Suspense>
            ),
            href: "/home/weather",
          },
        }
      : {}),
    reminders: iosUpcoming.length > 0
      ? { value: `${iosUpcoming.length} due`, sub: iosUpcoming[0].title as string, badge: iosUpcoming.length, href: "/home/tasks" }
      : { value: "None", sub: "All caught up", href: "/home/tasks" },
    health: { value: stepsToday > 0 ? Math.round(stepsToday).toLocaleString() : "—", sub: stepsToday > 0 ? (stepsIsToday ? "steps today" : `steps · ${stepsDayShort}`) : "Connect a device", href: "/health" },
    ...(netWorth != null
      ? {
          money: {
            value: <MoneyGlanceValue pct={netPct} locked={financeLocked} />,
            sub: "net worth trend",
            href: "/finance/dashboard",
          },
        }
      : {}),
  };

  // ── Activation checklist — surfaces setup steps until they're done ──────────
  const profileDone = Boolean(user.user_metadata?.full_name || user.user_metadata?.name);
  const locationDone = homePrefs?.latitude != null && homePrefs?.longitude != null;
  const familyDone = circleMembers.length > 0;
  const dataDone = iosUpcoming.length > 0 || netWorth != null || stepsToday > 0;
  const setupItems: SetupItem[] = [
    { key: "profile", label: "Complete your profile", href: "/settings", done: profileDone },
    { key: "location", label: "Set your location & timezone", href: "/settings", done: locationDone },
    { key: "family", label: "Invite your family", href: "/home/settings/family", done: familyDone },
    { key: "data", label: "Add a task or connect an account", href: "/home/tasks", done: dataDone },
  ];

  return (
    <HomeClient
      firstName={firstName}
      setupChecklist={<SetupChecklist items={setupItems} />}
      dateLabel={todayDisplay}
      greeting={greeting}
      glance={iosGlance}
      attention={iosAttention}
      timeline={iosTimeline}
      priorities={iosPriorities}
      family={iosFamily}
      members={circleMembers.map((m) => ({ id: m.id, label: m.label }))}
      currentUserId={user.id}
      quickActions={<QuickActions />}
      slot={
        <>
          <Suspense fallback={null}><TodayMarkets ticker={homePrefs?.employer_ticker ?? null} /></Suspense>
          <Suspense fallback={null}><TodayNews sources={homePrefs?.news_sources ?? []} topics={homePrefs?.news_topics ?? []} /></Suspense>
        </>
      }
    />
  );

}


// ── Timeline module hrefs (used by timelineItems builder above) ───────────────

const MODULE_HREF: Record<string, string> = {
  health:           "/health",
  finance:          "/finance/dashboard",
  investments:      "/investments",
  "student-success":"/home/me/courses",
  career:           "/career",
  bible:            "/bible",
};
