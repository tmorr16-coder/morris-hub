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
import { getAllUpcomingReminders } from "@/lib/reminders";
import StocksWidget from "./_components/StocksWidget";
import CompanyNewsWidget from "./_components/CompanyNewsWidget";
import HealthSummaryWidget from "./_components/HealthSummaryWidget";
import TodosWidget from "./_components/TodosWidget";
import NewsWidget from "./_components/NewsWidget";
import CityNewsWidget from "./_components/CityNewsWidget";
import SportsWidget from "./_components/SportsWidget";
import ClaudeTipCard from "./_components/ClaudeTipCard";
import NewsSubscriptionsWidget from "./_components/NewsSubscriptionsWidget";
import type { Todo } from "./actions";

const PRIORITY_WIDGETS = new Set(["todos"]);    // personal tasks only → My Priorities
// Family gets a dedicated WeekAhead component (not a widget-slot)
// "reminders" falls into Insights as a full management widget

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

  const [prefs, todoResult, reminders, profileResult, careerGoalsResult, workoutsResult] = await Promise.all([
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
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    service
      .from("scheduled_workouts")
      .select("id, label, scheduled_time")
      .eq("user_id", user.id)
      .eq("scheduled_date", todayStr)
      .order("scheduled_time", { ascending: true, nullsFirst: false }),
  ]);

  const todos = (todoResult.data ?? []) as Todo[];
  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";
  const activeCareerGoals: number = careerGoalsResult.count ?? 0;

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

  // Items needing attention: overdue todos + high-priority todos + overdue reminders
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
  const needsAttentionItems: Array<{ id: string; label: string; kind: "todo-overdue" | "todo-urgent" | "reminder-overdue" }> = [
    ...overdueTodos.map((t) => ({ id: `t-${t.id}`, label: t.title, kind: "todo-overdue" as const })),
    ...urgentTodos.map((t) => ({ id: `t-${t.id}`, label: t.title, kind: "todo-urgent" as const })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...overdueReminders.map((r: any) => ({ id: `r-${r.id}`, label: r.title, kind: "reminder-overdue" as const })),
  ].slice(0, 6);

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

  // Today's plan: cross-module timeline sorted chronologically
  const todayDueTodos = todos.filter((t) => !t.completed && t.due_date === todayStr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduledWorkouts = (workoutsResult.data ?? []) as { id: string; label: string; scheduled_time: string | null }[];

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

        {/* ── Needs Attention — overdue todos + urgent todos + overdue reminders ── */}
        {needsAttentionItems.length > 0 && (
          <section aria-labelledby="needs-attention-heading" style={{ marginBottom: 28 }}>
            <div
              style={{
                background: "rgba(184,138,46,0.07)",
                border: "1px solid rgba(184,138,46,0.25)",
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <h2
                id="needs-attention-heading"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-amber)",
                  margin: "0 0 10px",
                  fontFamily: "var(--font-geist, system-ui), sans-serif",
                }}
              >
                Needs attention
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {needsAttentionItems.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      fontSize: 13,
                      color: "var(--color-ink-2)",
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      fontFamily: "var(--font-geist, system-ui), sans-serif",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: item.kind === "todo-urgent" ? "var(--color-amber)" : "var(--color-red)",
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    <span>
                      {item.label}
                      <span style={{ marginLeft: 6, fontSize: 11, color: item.kind === "todo-urgent" ? "var(--color-amber)" : "var(--color-red)" }}>
                        {item.kind === "todo-urgent" ? "high priority" : "overdue"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Today's Plan — cross-module timeline ── */}
        <section aria-labelledby="today-plan-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="today-plan-heading">Today&apos;s plan</SectionHeader>
          <TodayTimeline items={timelineItems} />
        </section>

        {/* ── Ask Morris — dedicated AI surface ── */}
        <section aria-label="Ask Morris" style={{ marginBottom: 28 }}>
          <HubChat firstName={firstName} />
        </section>

        {/* ── My Priorities — personal todos only ── */}
        {priorityWids.length > 0 && (
          <section aria-labelledby="priorities-heading" style={{ marginBottom: 28 }}>
            <SectionHeader id="priorities-heading">My priorities</SectionHeader>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
              {priorityWids.map((widgetId) =>
                renderWidget(widgetId, { todos, reminders, prefs, userTz, activeCareerGoals })
              )}
            </div>
          </section>
        )}

        {/* ── Family — week-ahead household view ── */}
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

        {/* ── Insights ── */}
        {insightWids.length > 0 && (
          <section aria-labelledby="insights-heading">
            <SectionHeader id="insights-heading">Insights</SectionHeader>
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
          </section>
        )}
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

// ── Today timeline ──────────────────────────────────────────────────────────

interface TimelineItem {
  id: string;
  sortKey: string;
  timeLabel: string;
  label: string;
  module: string;
  category: string;
  href?: string;
}

// Module color dots — matches the platform nav palette
const MODULE_HREF: Record<string, string> = {
  health:           "/health",
  finance:          "/finance/dashboard",
  investments:      "/investments",
  "student-success":"/student-success",
  career:           "/career",
  bible:            "/bible",
};

const MODULE_DOT: Record<string, string> = {
  hub:              "var(--color-accent)",
  health:           "#4D6B3A",
  finance:          "#8B6A47",
  investments:      "#C97A3A",
  "student-success":"#6B5B95",
  career:           "#2A6049",
  bible:            "#7B5EA7",
  // category overrides
  appointment:      "var(--color-accent)",
  medication:       "#4D6B3A",
  workout:          "#C97A3A",
  bill:             "var(--color-amber)",
  todo:             "var(--color-ink-4)",
  general:          "var(--color-ink-3)",
};

const MODULE_LABEL: Record<string, string> = {
  hub:              "Hub",
  health:           "Health",
  finance:          "Finance",
  investments:      "Investments",
  "student-success":"Kids",
  career:           "Career",
  bible:            "Bible",
  workout:          "Health",
};

function TimelineRow({ item }: { item: TimelineItem }) {
  const dotColor = MODULE_DOT[item.category] ?? MODULE_DOT[item.module] ?? "var(--color-ink-3)";
  const moduleTag = MODULE_LABEL[item.module];

  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "11px 20px",
        borderBottom: "1px solid var(--color-rule-soft)",
      }}
    >
      {/* Time */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-ink-4)",
          minWidth: 58,
          fontFamily: "var(--font-geist, system-ui), sans-serif",
          letterSpacing: "0.02em",
          flexShrink: 0,
        }}
      >
        {item.timeLabel}
      </span>
      {/* Category dot */}
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
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
      {/* Module badge */}
      {moduleTag && (
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
          {moduleTag}
        </span>
      )}
    </div>
  );

  return item.href ? (
    <a href={item.href} style={{ display: "block", textDecoration: "none" }}>
      {inner}
    </a>
  ) : inner;
}

function TodayTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--color-ink-4)",
            margin: 0,
            fontFamily: "var(--font-geist, system-ui), sans-serif",
          }}
        >
          Nothing scheduled for today.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}
    >
      {items.map((item) => (
        <TimelineRow key={item.id} item={item} />
      ))}
    </div>
  );
}

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
