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

  const [prefs, todoResult, reminders, profileResult, careerGoalsResult] = await Promise.all([
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
  ]);

  const todos = (todoResult.data ?? []) as Todo[];
  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";
  const activeCareerGoals: number = careerGoalsResult.count ?? 0;

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];
  const userTz = "America/Indiana/Indianapolis";
  const today = new Date();
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
  const todayStr = today.toLocaleDateString("sv", { timeZone: userTz }); // YYYY-MM-DD

  // Items needing attention: overdue or high-priority incomplete todos
  const overdueTodos = todos.filter(
    (t) => !t.completed && t.due_date && t.due_date < todayStr
  );
  const urgentTodos = todos.filter(
    (t) => !t.completed && t.priority === "high" && (!t.due_date || t.due_date >= todayStr)
  );
  const needsAttention = [...overdueTodos, ...urgentTodos].slice(0, 5);

  // Today's plan: reminders due today sorted chronologically + todos due today
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayReminders = (reminders as any[])
    .filter((r) => {
      const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
      return localDate === todayStr;
    })
    .sort((a: { due_at: string }, b: { due_at: string }) => a.due_at.localeCompare(b.due_at));
  const todayDueTodos = todos.filter((t) => !t.completed && t.due_date === todayStr);

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin,
    appAccess: prefs.app_access ?? null,
  };

  // Split widgets into priorities vs insights
  const priorityWids = prefs.visible_widgets.filter((w) => PRIORITY_WIDGETS.has(w));
  const insightWids = prefs.visible_widgets.filter((w) => !PRIORITY_WIDGETS.has(w));

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

        {/* ── Needs Attention ── */}
        {needsAttention.length > 0 && (
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
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {needsAttention.map((todo) => (
                  <li
                    key={todo.id}
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
                        background: todo.due_date && todo.due_date < todayStr
                          ? "var(--color-red)"
                          : "var(--color-amber)",
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    <span>
                      {todo.title}
                      {todo.due_date && todo.due_date < todayStr && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-red)" }}>
                          overdue
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Ask Morris ── */}
        <section aria-labelledby="ask-morris-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="ask-morris-heading">Ask Morris</SectionHeader>
          <HubChat firstName={firstName} />
        </section>

        {/* ── Today's Plan — chronological schedule ── */}
        <section aria-labelledby="today-plan-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="today-plan-heading">Today&apos;s plan</SectionHeader>
          <TodayTimeline
            reminders={todayReminders}
            todos={todayDueTodos}
            userTz={userTz}
          />
        </section>

        {/* ── My Priorities — todos + reminders ── */}
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

        {/* ── Family ── */}
        <section aria-labelledby="family-heading" style={{ marginBottom: 28 }}>
          <SectionHeader id="family-heading">Family</SectionHeader>
          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "var(--shadow-card)",
              maxWidth: 480,
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: "var(--color-ink-3)",
                margin: "0 0 12px",
                lineHeight: 1.5,
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              Family sharing and status coming soon.
            </p>
            <a
              href="/home/settings/family"
              style={{
                fontSize: 12,
                color: "var(--color-accent)",
                textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              Manage family circle →
            </a>
          </div>
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

// ── Today timeline ──────────────────────────────────────────────────────────

const CATEGORY_DOT: Record<string, string> = {
  appointment: "var(--color-accent)",
  medication:  "var(--color-green)",
  workout:     "#C97A3A",
  bill:        "var(--color-amber)",
  personal:    "var(--color-ink-3)",
  general:     "var(--color-ink-3)",
  todo:        "var(--color-ink-4)",
};

function TimelineRow({ time, label, category }: { time: string; label: string; category: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 20px",
        borderBottom: "1px solid var(--color-rule-soft)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-ink-4)",
          minWidth: 56,
          fontFamily: "var(--font-geist, system-ui), sans-serif",
          letterSpacing: "0.02em",
          flexShrink: 0,
        }}
      >
        {time}
      </span>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: CATEGORY_DOT[category] ?? "var(--color-ink-3)",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: "var(--color-ink-2)",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function TodayTimeline({
  reminders,
  todos,
  userTz,
}: {
  reminders: Array<{ id: string; due_at: string; title: string; category: string }>;
  todos: Todo[];
  userTz: string;
}) {
  const hasItems = reminders.length > 0 || todos.length > 0;

  if (!hasItems) {
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
      {reminders.map((r) => {
        const time = new Date(r.due_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: userTz,
        });
        return (
          <TimelineRow key={r.id} time={time} label={r.title} category={r.category} />
        );
      })}
      {todos.map((t) => (
        <TimelineRow key={t.id} time="Due today" label={t.title} category="todo" />
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
