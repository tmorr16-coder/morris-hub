import { Suspense, type ReactNode } from "react";
import WeatherWidget from "../_components/WeatherWidget";
import RemindersWidget from "../_components/RemindersWidget";
import StocksWidget from "../_components/StocksWidget";
import CompanyNewsWidget from "../_components/CompanyNewsWidget";
import HealthSummaryWidget from "../_components/HealthSummaryWidget";
import TodosWidget from "../_components/TodosWidget";
import NewsWidget from "../_components/NewsWidget";
import CityNewsWidget from "../_components/CityNewsWidget";
import SportsWidget from "../_components/SportsWidget";
import ClaudeTipCard from "../_components/ClaudeTipCard";
import NewsSubscriptionsWidget from "../_components/NewsSubscriptionsWidget";
import type { Todo } from "../actions";

// ── Section header ──────────────────────────────────────────────────────────

export function SectionHeader({ id, children }: { id: string; children: ReactNode }) {
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

export type WidgetContext = {
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

export function renderWidget(widgetId: string, ctx: WidgetContext): ReactNode {
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
      // Company News is driven by the employer ticker — hide it entirely when
      // the user hasn't set one (rather than showing an empty/broken card).
      return prefs.employer_ticker ? (
        <Suspense key="lly_news" fallback={<WidgetSkeleton title="Company news" />}>
          <CompanyNewsWidget ticker={prefs.employer_ticker} />
        </Suspense>
      ) : null;
    case "news":
      // Hide until the user picks at least one news topic.
      return prefs.news_topics?.length ? (
        <Suspense key="news" fallback={<WidgetSkeleton title="News" lines={4} />}>
          <NewsWidget topics={prefs.news_topics} />
        </Suspense>
      ) : null;
    case "city_news":
      // Hide until the user adds at least one city.
      return prefs.city_names?.length ? (
        <Suspense key="city_news" fallback={<WidgetSkeleton title="Local news" lines={4} />}>
          <CityNewsWidget cities={prefs.city_names} />
        </Suspense>
      ) : null;
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
