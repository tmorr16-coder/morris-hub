export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAllUpcomingReminders, getAssignedReminders } from "@/lib/reminders";
import { findConflicts, type TimelineItem } from "./_components/timelineConflicts";
import { getFamilyCalendarEvents } from "@/lib/familyCalendar";
import type { Todo } from "./actions";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Gate: redirect new users to onboarding
  try {
    const { data: onboardingCheck } = await service
      .schema("hub")
      .from("preferences")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (onboardingCheck && onboardingCheck.onboarding_completed === false) {
      redirect("/onboarding");
    }
  } catch {
    // Column doesn't exist yet — skip
  }

  // Compute early so workouts query can filter by today's date
  const userTz = "America/Indiana/Indianapolis";
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

  // Family circle members for FamilyTimeline filter chips + household reminders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleMembers = ((circleResult.data ?? []) as any[]).map((m) => ({
    id: m.member_user_id as string,
    label: (m.display_name ?? m.nickname ?? "Member") as string,
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

  interface AttentionItem {
    id: string;
    severity: "Urgent" | "Today" | "This week" | "Informational";
    title: string;
    context: string;
    who: string;
    person?: string;
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
      primaryAction: { label: "Assign", href: "/home/family" },
    })),
    // Overdue todos → Urgent
    ...overdueTodos.slice(0, 2).map((t) => ({
      id: `t-overdue-${t.id}`,
      severity: "Urgent" as const,
      title: t.title,
      context: `Overdue task · was due ${fmtDueDate(t.due_date!)}`,
      who: "You",
      primaryAction: { label: "Open task", href: "/home" },
    })),
    // Bills due today → Today
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...billsDueToday.slice(0, 2).map((r: any) => ({
      id: `r-bill-${r.id}`,
      severity: "Today" as const,
      title: r.title,
      context: `Payment due today · ${new Date(r.due_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz })}`,
      who: "You",
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
      primaryAction: { label: "View", href: MODULE_ACTION_HREF[r.source_app as string] ?? "/home" },
    })),
    // High-priority todos → Today or This week
    ...urgentTodos.slice(0, 1).map((t) => ({
      id: `t-urgent-${t.id}`,
      severity: (t.due_date === todayStr ? "Today" : "This week") as "Today" | "This week",
      title: t.title,
      context: `High priority${t.due_date ? ` · due ${fmtDueDate(t.due_date)}` : ""}`,
      who: "You",
      primaryAction: { label: "Open task", href: "/home" },
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
  }));
  const iosTimeline = timelineItems.map((t) => ({ id: t.id, time: t.timeLabel, label: t.label, category: t.category }));
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
  const iosNext = timelineItems[0];
  const iosCalLabel = iosNext ? (iosNext.label.length > 16 ? iosNext.label.slice(0, 15) + "…" : iosNext.label) : "Clear";
  // Health + Money glance — light lookups (steps today, latest net-worth snapshot)
  const [stepsRes, netRes] = await Promise.all([
    service.from("apple_health_metrics")
      .select("value")
      .eq("user_id", user.id)
      .in("metric_name", ["step_count", "steps", "Step Count", "Steps"])
      .gte("timestamp", new Date(new Date().getTime() - 26 * 3_600_000).toISOString()),
    service.schema("finance").from("net_position_snapshots")
      .select("net_position").eq("user_id", user.id)
      .order("captured_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepsToday = ((stepsRes.data ?? []) as any[]).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const netWorth: number | null = (netRes.data as { net_position?: number } | null)?.net_position ?? null;
  const fmtNetShort = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

  const iosGlance = {
    calendar: { value: iosCalLabel, sub: iosNext ? iosNext.timeLabel : "No events today", href: "/home/family/calendar" },
    reminders: iosUpcoming.length > 0
      ? { value: `${iosUpcoming.length} due`, sub: iosUpcoming[0].title as string, badge: iosUpcoming.length, href: "/home" }
      : { value: "None", sub: "All caught up", href: "/home" },
    health: { value: stepsToday > 0 ? Math.round(stepsToday).toLocaleString() : "—", sub: stepsToday > 0 ? "steps today" : "no data today", href: "/health" },
    ...(netWorth != null ? { money: { value: fmtNetShort(netWorth), sub: "net worth", href: "/finance/dashboard" } } : {}),
  };

  return (
    <HomeClient
      firstName={firstName}
      dateLabel={todayDisplay}
      greeting={greeting}
      glance={iosGlance}
      attention={iosAttention}
      timeline={iosTimeline}
      priorities={iosPriorities}
      family={iosFamily}
      members={circleMembers.map((m) => ({ id: m.id, label: m.label }))}
      currentUserId={user.id}
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
