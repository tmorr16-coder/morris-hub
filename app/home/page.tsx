export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { Suspense, type ReactNode } from "react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import HubChat from "./_components/HubChat";
import WeatherWidget from "./_components/WeatherWidget";
import RemindersWidget from "./_components/RemindersWidget";
import { getAllUpcomingReminders, getAssignedReminders } from "@/lib/reminders";
import StocksWidget from "./_components/StocksWidget";
import CompanyNewsWidget from "./_components/CompanyNewsWidget";
import HealthSummaryWidget from "./_components/HealthSummaryWidget";
import TodosWidget from "./_components/TodosWidget";
import NewsWidget from "./_components/NewsWidget";
import CityNewsWidget from "./_components/CityNewsWidget";
import SportsWidget from "./_components/SportsWidget";
import ClaudeTipCard from "./_components/ClaudeTipCard";
import NewsSubscriptionsWidget from "./_components/NewsSubscriptionsWidget";
import CollapsibleSection from "./_components/CollapsibleSection";
import FamilyTimeline from "./_components/FamilyTimeline";
import type { TimelineItem } from "./_components/FamilyTimeline";
import type { Todo } from "./actions";

// My Priorities: todos (personal tasks) + reminders (includes household task toggle)
const PRIORITY_WIDGETS = new Set(["todos", "reminders"]);

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

  const [prefs, todoResult, reminders, profileResult, careerGoalsResult, workoutsResult, assignedReminders, circleResult] = await Promise.all([
    getPreferences(user.id),
    service
      .schema("hub")
      .from("todos")
      .select("id, title, completed, notes, due_date, priority, created_at")
      .eq("user_id", user.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
    getAllUpcomingReminders(user.id),
    service.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    service
      .schema("career")
      .from("career_goals")
      .select("id, title, target_date, horizon, category")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .limit(5),
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
      .select("member_user_id, display_name, nickname")
      .eq("user_id", user.id),
  ]);

  const todos = (todoResult.data ?? []) as Todo[];
  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";

  // Family circle members for FamilyTimeline filter chips + household reminders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleMembers = ((circleResult.data ?? []) as any[]).map((m) => ({
    id: m.member_user_id as string,
    label: (m.display_name ?? m.nickname ?? "Member") as string,
  }));
  const memberIds = circleMembers.map((m) => m.id);

  // Fetch household reminders from circle members (requires Phase 2b RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let familyHouseholdReminders: any[] = [];
  if (memberIds.length > 0) {
    const { data: hwData } = await service
      .schema("hub")
      .from("reminders")
      .select("id, title, due_at, category, source_app, user_id, assigned_to")
      .eq("is_household", true)
      .is("completed_at", null)
      .in("user_id", memberIds)
      .lte("due_at", new Date(Date.now() + 7 * 86_400_000).toISOString())
      .order("due_at", { ascending: true });
    familyHouseholdReminders = hwData ?? [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const careerGoals = (careerGoalsResult.data ?? []) as Array<{ id: string; title: string; target_date: string | null; horizon: string; category: string }>;
  const activeCareerGoals = careerGoals.length;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  interface AttentionItem {
    id: string;
    severity: "Urgent" | "Today" | "This week" | "Informational";
    title: string;
    context: string;
    who: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MODULE_ACTION_HREF: Record<string, string> = {
    health: "/health", finance: "/finance/dashboard",
    investments: "/investments", "student-success": "/student-success",
    career: "/career", bible: "/bible", hub: "/home",
  };

  const attentionItems: AttentionItem[] = [
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
  }).slice(0, 5);

  // Track total for "View all" link
  const totalAttentionCount = overdueTodos.length + overdueReminders.length + billsDueToday.length + urgentTodos.length;

  // ── My Priorities — four categories, one item each ──────────────────────────
  interface MyPriority {
    category: "career" | "health" | "family" | "wellness";
    icon: string;
    title: string;
    why: string;
    href: string;
    action: string;
  }

  const myPriorities: MyPriority[] = [];

  // Career: first active goal
  if (careerGoals.length > 0) {
    const g = careerGoals[0];
    myPriorities.push({
      category: "career",
      icon: "🎯",
      title: g.title,
      why: `Active career goal${g.target_date ? ` · due ${fmtDueDate(g.target_date)}` : ""}`,
      href: "/career/goals",
      action: "View goal",
    });
  } else if (activeCareerGoals === 0) {
    // No goals — surface the opportunity
    myPriorities.push({
      category: "career",
      icon: "🎯",
      title: "Set a career goal",
      why: "No active goals — define your next milestone",
      href: "/career/goals/new",
      action: "Add goal",
    });
  }

  // Health: next scheduled workout or health reminder
  const nextWorkout = scheduledWorkouts[0] as { id: string; label: string; scheduled_time: string | null } | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthReminder = (reminders as any[]).find(
    (r) => r.source_app === "health" && !r.completed_at
  );
  if (nextWorkout) {
    myPriorities.push({
      category: "health",
      icon: "💪",
      title: nextWorkout.label || "Workout",
      why: `Scheduled for today${nextWorkout.scheduled_time ? ` at ${new Date(`${todayStr}T${nextWorkout.scheduled_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: userTz })}` : ""}`,
      href: "/health/train",
      action: "Start workout",
    });
  } else if (healthReminder) {
    myPriorities.push({
      category: "health",
      icon: "💊",
      title: healthReminder.title,
      why: "Health reminder for today",
      href: "/health",
      action: "View",
    });
  }

  // Family: next reminder with family context, or top incomplete non-overdue todo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familyReminder = (reminders as any[]).find(
    (r) => !r.completed_at && ["appointment", "general"].includes(r.category) && r.source_app === "hub"
  );
  const familyTodo = todos.find(
    (t) => !t.completed && t.priority === "medium" && !overdueTodos.find((o) => o.id === t.id)
  );
  if (familyReminder) {
    myPriorities.push({
      category: "family",
      icon: "👨‍👩‍👧",
      title: familyReminder.title,
      why: `Upcoming · ${new Date(familyReminder.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: userTz })}`,
      href: "/home",
      action: "View",
    });
  } else if (familyTodo) {
    myPriorities.push({
      category: "family",
      icon: "👨‍👩‍👧",
      title: familyTodo.title,
      why: "From your priorities",
      href: "/home",
      action: "Open task",
    });
  }

  // Wellness: personal reminder or first low-priority todo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wellnessReminder = (reminders as any[]).find(
    (r) => !r.completed_at && ["personal", "medication"].includes(r.category)
  );
  if (wellnessReminder) {
    myPriorities.push({
      category: "wellness",
      icon: "🧘",
      title: wellnessReminder.title,
      why: `${CATEGORY_CONTEXT[wellnessReminder.category] ?? "Reminder"} · surfaced because it's upcoming`,
      href: "/home",
      action: "View",
    });
  }

  // Week ahead: reminders for the next 7 days (tomorrow → +7d), grouped by date
  const weekAheadItems = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upcoming = (reminders as any[]).filter((r) => {
      if (r.completed_at) return false;
      const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
      return localDate > todayStr; // strictly after today
    });
    const byDay: Record<string, Array<{ id: string; title: string; category: string; source_app: string }>> = {};
    for (const r of upcoming) {
      const dateKey = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
      if (!byDay[dateKey]) byDay[dateKey] = [];
      if (byDay[dateKey].length < 4) byDay[dateKey].push({ id: r.id, title: r.title, category: r.category, source_app: r.source_app });
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5); // cap at 5 days
  })();

  // Today's plan timeline items
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...familyHouseholdReminders
      .filter((r: any) => {
        const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
        return localDate === todayStr;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => {
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

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin,
    appAccess: prefs.app_access ?? null,
  };

  // todos → My Priorities; everything else (including reminders) → Insights
  const priorityWids = prefs.visible_widgets.filter((w) => PRIORITY_WIDGETS.has(w));
  const insightWids  = prefs.visible_widgets.filter((w) => !PRIORITY_WIDGETS.has(w));

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />

      <main
        style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 20px 100px" }}
        id="main-content"
      >
        {/* ── Greeting ── */}
        <section aria-label="Greeting" style={{ marginBottom: 36 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              marginBottom: 10,
              fontFamily: "var(--font-geist, system-ui), sans-serif",
            }}
          >
            {todayDisplay}
          </div>
          <h1
            className="serif"
            style={{ fontSize: 44, lineHeight: 1.05, margin: 0 }}
          >
            {greeting},
            <br />
            <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>
              {firstName}.
            </span>
          </h1>
        </section>

        {/* ══ SECTION 1: Needs Attention ════════════════════════════════════════ */}
        {attentionItems.length > 0 && (
          <section aria-labelledby="needs-attention-heading" style={{ marginBottom: 28 }}>
            <SectionHeader id="needs-attention-heading">Needs attention</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {attentionItems.map((item) => {
                const severityColor =
                  item.severity === "Urgent" ? "var(--color-red)"
                  : item.severity === "Today" ? "var(--color-amber)"
                  : item.severity === "This week" ? "var(--color-ink-3)"
                  : "var(--color-ink-4)";
                return (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--color-bg-card)",
                      border: `1px solid var(--color-rule)`,
                      borderLeft: `3px solid ${severityColor}`,
                      borderRadius: 10,
                      padding: "12px 16px",
                      boxShadow: "var(--shadow-card)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {/* Title row with severity badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: severityColor,
                          flexShrink: 0,
                          fontFamily: "var(--font-geist, system-ui), sans-serif",
                        }}
                        aria-label={`Severity: ${item.severity}`}
                      >
                        {item.severity}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-ink)",
                          fontFamily: "var(--font-geist, system-ui), sans-serif",
                          flex: 1,
                        }}
                      >
                        {item.title}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif", flexShrink: 0 }}>
                        {item.who}
                      </span>
                    </div>
                    {/* Context */}
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                      {item.context}
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      <a
                        href={item.primaryAction.href}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: "5px 12px",
                          borderRadius: 7, background: "var(--color-accent)", color: "#FFFDF8",
                          textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif",
                        }}
                      >
                        {item.primaryAction.label}
                      </a>
                      {item.secondaryAction && (
                        <a
                          href={item.secondaryAction.href}
                          style={{
                            fontSize: 12, fontWeight: 500, padding: "5px 12px",
                            borderRadius: 7, border: "1px solid var(--color-rule)",
                            color: "var(--color-ink-2)", textDecoration: "none",
                            fontFamily: "var(--font-geist, system-ui), sans-serif",
                            background: "transparent",
                          }}
                        >
                          {item.secondaryAction.label}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {totalAttentionCount > 5 && (
                <a
                  href="/home"
                  style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif", padding: "4px 0" }}
                >
                  View all {totalAttentionCount} items →
                </a>
              )}
            </div>
          </section>
        )}

        {/* ══ SECTION 2: Today's Plan ════════════════════════════════════════════ */}
        <section aria-labelledby="today-plan-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="today-plan-heading">Today&apos;s plan</SectionHeader>
          <FamilyTimeline items={timelineItems} members={circleMembers} />
        </section>

        {/* ══ SECTION 3: Family Status ══════════════════════════════════════════ */}
        <section aria-labelledby="family-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="family-heading">Family</SectionHeader>
          <WeekAhead
            weekItems={weekAheadItems}
            today={today}
            userTz={userTz}
            activeCareerGoals={activeCareerGoals}
            appAccess={prefs.app_access ?? []}
          />
        </section>

        {/* ══ SECTION 4: My Priorities ══════════════════════════════════════════ */}
        <section aria-labelledby="priorities-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="priorities-heading">My priorities</SectionHeader>

          {/* TodosWidget — always present, core My Priorities tool */}
          <div style={{ marginBottom: 14 }}>
            <TodosWidget initialTodos={todos} />
          </div>

          {/* RemindersWidget — includes 🏠 household task toggle */}
          {priorityWids.filter((w) => w !== "todos").map((widgetId) => (
            <div key={widgetId} style={{ marginBottom: 14 }}>
              {renderWidget(widgetId, { todos, reminders, prefs, userTz, activeCareerGoals })}
            </div>
          ))}

          {/* Compact goal/health/family/wellness summary cards */}
          {myPriorities.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myPriorities.map((p) => (
                <div
                  key={`${p.category}-${p.title}`}
                  style={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    boxShadow: "var(--shadow-card)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                      {p.why}
                    </div>
                  </div>
                  <a
                    href={p.href}
                    style={{
                      fontSize: 12, fontWeight: 500, padding: "5px 12px",
                      borderRadius: 7, border: "1px solid var(--color-rule)",
                      color: "var(--color-ink-2)", textDecoration: "none",
                      fontFamily: "var(--font-geist, system-ui), sans-serif",
                      background: "transparent", flexShrink: 0,
                    }}
                  >
                    {p.action}
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ══ SECTION 5: Insights — collapsed by default ════════════════════════ */}
        {insightWids.length > 0 && (
          <CollapsibleSection id="insights-heading" label="Insights" defaultOpen={false}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 14,
                alignItems: "stretch",
              }}
            >
              {insightWids.map((widgetId) =>
                renderWidget(widgetId, { todos, reminders, prefs, userTz, activeCareerGoals, user })
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Ask Morris — compact, below all sections */}
        <section aria-label="Ask Morris" style={{ marginTop: 32 }}>
          <HubChat firstName={firstName} />
        </section>
      </main>
    </div>
  );
}

// ── Week-ahead family view ───────────────────────────────────────────────────

const WEEK_DOT: Record<string, string> = {
  appointment: "var(--color-accent)",
  medication:  "#4D6B3A",
  workout:     "#C97A3A",
  bill:        "var(--color-amber)",
  personal:    "var(--color-ink-3)",
  general:     "var(--color-ink-3)",
};

const WEEK_MODULE_LABEL: Record<string, string> = {
  health:           "Health",
  finance:          "Finance",
  "student-success":"Kids",
  career:           "Career",
};

function weekDayLabel(dateStr: string, today: Date, userTz: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const tomorrowStr = new Date(today.getTime() + 86_400_000)
    .toLocaleDateString("sv", { timeZone: userTz });
  if (dateStr === tomorrowStr) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function WeekAhead({
  weekItems,
  today,
  userTz,
  activeCareerGoals,
  appAccess,
}: {
  weekItems: Array<[string, Array<{ id: string; title: string; category: string; source_app: string }>]>;
  today: Date;
  userTz: string;
  activeCareerGoals: number;
  appAccess: string[];
}) {
  const hasItems = weekItems.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Week-ahead reminders grouped by day */}
      {hasItems ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          {weekItems.map(([dateStr, items], di) => (
            <div key={dateStr}>
              {/* Day header */}
              <div
                style={{
                  padding: "9px 20px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-4)",
                  fontFamily: "var(--font-geist, system-ui), sans-serif",
                  background: di % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                  borderTop: di > 0 ? "1px solid var(--color-rule-soft)" : "none",
                }}
              >
                {weekDayLabel(dateStr, today, userTz)}
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 20px",
                    background: di % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: WEEK_DOT[item.category] ?? "var(--color-ink-3)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--color-ink-2)",
                      fontFamily: "var(--font-geist, system-ui), sans-serif",
                      flex: 1,
                    }}
                  >
                    {item.title}
                  </span>
                  {WEEK_MODULE_LABEL[item.source_app] && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--color-ink-4)",
                        flexShrink: 0,
                      }}
                    >
                      {WEEK_MODULE_LABEL[item.source_app]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--color-ink-4)", margin: 0, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Nothing coming up this week.
          </p>
        </div>
      )}

      {/* Module summary links */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {appAccess.includes("student-success") && (
          <a href="/student-success" style={{ ...summaryChipStyle, borderColor: "#6B5B95", color: "#6B5B95" }}>
            Kids →
          </a>
        )}
        {appAccess.includes("health") && (
          <a href="/health" style={{ ...summaryChipStyle, borderColor: "#4D6B3A", color: "#4D6B3A" }}>
            Health →
          </a>
        )}
        {(appAccess.includes("finance") || appAccess.includes("investments")) && (
          <a href="/finance/dashboard" style={{ ...summaryChipStyle, borderColor: "#8B6A47", color: "#8B6A47" }}>
            Finance →
          </a>
        )}
        {activeCareerGoals > 0 && appAccess.includes("career") && (
          <a href="/career/goals" style={{ ...summaryChipStyle, borderColor: "#2A6049", color: "#2A6049" }}>
            {activeCareerGoals} career goal{activeCareerGoals !== 1 ? "s" : ""} →
          </a>
        )}
        <a href="/home/settings/family" style={{ ...summaryChipStyle }}>
          Manage circle →
        </a>
      </div>
    </div>
  );
}

const summaryChipStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  padding: "5px 12px",
  borderRadius: 20,
  border: "1px solid var(--color-rule)",
  color: "var(--color-ink-3)",
  textDecoration: "none",
  fontFamily: "var(--font-geist, system-ui), sans-serif",
  background: "var(--color-bg-card)",
};

// ── Timeline module hrefs (used by timelineItems builder above) ───────────────

const MODULE_HREF: Record<string, string> = {
  health:           "/health",
  finance:          "/finance/dashboard",
  investments:      "/investments",
  "student-success":"/student-success",
  career:           "/career",
  bible:            "/bible",
};

// ── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--color-ink-4)",
        margin: "0 0 12px",
        fontFamily: "var(--font-geist, system-ui), sans-serif",
      }}
    >
      {children}
    </h2>
  );
}

// ── Widget renderer ─────────────────────────────────────────────────────────

type WidgetContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prefs: any;
  todos: Todo[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reminders: any;
  userTz: string;
  activeCareerGoals: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any;
};

function renderWidget(widgetId: string, ctx: WidgetContext): ReactNode {
  const { prefs, todos, reminders, userTz, activeCareerGoals, user } = ctx;
  switch (widgetId) {
    case "health":
      return (
        <Suspense key="health" fallback={<WidgetSkeleton title="Health" lines={3} />}>
          <HealthSummaryWidget userId={user?.id} />
        </Suspense>
      );
    case "weather":
      return prefs.latitude != null && prefs.longitude != null ? (
        <Suspense key="weather" fallback={<WidgetSkeleton title="Weather" />}>
          <WeatherWidget lat={prefs.latitude} lon={prefs.longitude} locationName={prefs.location_name ?? ""} />
        </Suspense>
      ) : null;
    case "reminders":
      return (
        <RemindersWidget
          key="reminders"
          initialReminders={reminders}
          tz={userTz}
          categories={prefs.reminder_categories}
        />
      );
    case "todos":
      return <TodosWidget key="todos" initialTodos={todos} />;
    case "stocks":
      return (
        <Suspense key="stocks" fallback={<WidgetSkeleton title="Stocks" />}>
          <StocksWidget tickers={prefs.stock_tickers} />
        </Suspense>
      );
    case "sports":
      return (
        <Suspense key="sports" fallback={<WidgetSkeleton title="Sports" lines={3} />}>
          <SportsWidget teams={prefs.sports_enabled_teams} />
        </Suspense>
      );
    case "lly_news":
      return (
        <Suspense key="lly_news" fallback={<WidgetSkeleton title="Company news" />}>
          <CompanyNewsWidget ticker={prefs.employer_ticker ?? "LLY"} />
        </Suspense>
      );
    case "news":
      return (
        <Suspense key="news" fallback={<WidgetSkeleton title="News" lines={4} />}>
          <NewsWidget topics={prefs.news_topics} />
        </Suspense>
      );
    case "city_news":
      return (
        <Suspense key="city_news" fallback={<WidgetSkeleton title="Local news" lines={4} />}>
          <CityNewsWidget cities={prefs.city_names} />
        </Suspense>
      );
    case "news_subscriptions":
      return (
        <Suspense key="news_subscriptions" fallback={<WidgetSkeleton title="My subscriptions" lines={4} />}>
          <NewsSubscriptionsWidget sources={prefs.news_sources ?? []} />
        </Suspense>
      );
    case "tips":
      return (
        <Suspense key="tips" fallback={<WidgetSkeleton title="Tips" lines={3} />}>
          <ClaudeTipCard />
        </Suspense>
      );
    case "career":
      return (
        <div
          key="career"
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderLeft: "4px solid #2A6049",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h3 className="serif" style={{ fontSize: 20, color: "var(--color-ink)", margin: 0 }}>
              Career
            </h3>
            <a
              href="/career"
              style={{
                fontSize: 12,
                color: "#2A6049",
                textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              Open →
            </a>
          </div>
          {activeCareerGoals === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--color-ink-3)",
                lineHeight: 1.5,
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              No active goals yet.{" "}
              <a href="/career/goals/new" style={{ color: "#2A6049", textDecoration: "none" }}>
                Start your first goal →
              </a>
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: "var(--color-ink-2)",
                lineHeight: 1.6,
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 28, color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                {activeCareerGoals}
              </span>{" "}
              active goal{activeCareerGoals !== 1 ? "s" : ""}
              <div style={{ marginTop: 10 }}>
                <a href="/career/goals" style={{ fontSize: 12, color: "#2A6049", textDecoration: "none" }}>
                  View goals →
                </a>
              </div>
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function WidgetSkeleton({ title, lines = 2 }: { title: string; lines?: number }) {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "var(--shadow-card)",
        minHeight: 180,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 className="serif" style={{ fontSize: 20, color: "var(--color-ink)", margin: 0 }}>{title}</h2>
        <span
          style={{
            fontSize: 10,
            color: "var(--color-ink-4)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-geist, system-ui), sans-serif",
          }}
        >
          loading…
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 14,
              background: "var(--color-bg-deep)",
              borderRadius: 4,
              opacity: 0.4 + (lines - i) * 0.1,
              width: `${100 - i * 12}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
