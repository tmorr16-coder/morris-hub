export const dynamic = "force-dynamic";
// Allow up to 60s so a cold news+web_search fetch can complete on
// cache miss without timing out. The Suspense boundaries below let
// the rest of the page stream first regardless.
export const maxDuration = 60;

import { Suspense } from "react";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import SignOutButton from "./_components/SignOutButton";
import HubChat from "./_components/HubChat";
import WeatherWidget from "./_components/WeatherWidget";
import RemindersWidget from "./_components/RemindersWidget";
import { getUpcomingReminders } from "@/lib/reminders";
import StocksWidget from "./_components/StocksWidget";
import LLYNewsWidget from "./_components/LLYNewsWidget";
import HealthSummaryWidget from "./_components/HealthSummaryWidget";
import TodosWidget from "./_components/TodosWidget";
import NewsWidget from "./_components/NewsWidget";
import ClaudeTipCard from "./_components/ClaudeTipCard";
import type { Todo } from "./actions";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Parallelize the 4 independent reads — was previously sequential.
  // Total time drops from sum-of-roundtrips to max-of-roundtrips (~150ms).
  const [prefs, todoResult, reminders, profileResult] = await Promise.all([
    getPreferences(user.id),
    service
      .schema("hub")
      .from("todos")
      .select("id, title, completed, notes, due_date, priority, created_at")
      .eq("user_id", user.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
    getUpcomingReminders(user.id),
    service
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const todos = (todoResult.data ?? []) as Todo[];
  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];
  // Use the user's location timezone (default to Indianapolis if not resolvable).
  // Vercel functions run in UTC by default, so we must pass timeZone explicitly.
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
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: userTz,
  });

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 80px" }}>
        {/* App-level controls */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
          <Link
            href="/home/settings"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--color-rule)",
              background: "transparent",
              color: "var(--color-ink-2)",
              fontSize: 12,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ⚙ Settings
          </Link>
          <SignOutButton />
        </div>
        {/* Greeting */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
            {todayDisplay}
          </div>
          <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05 }}>
            {greeting},
            <br />
            <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>{firstName}.</span>
          </h1>
        </section>

        {/* Ask Claude — main interaction surface */}
        <section style={{ marginBottom: 14 }}>
          <HubChat firstName={firstName} />
        </section>

        {/* Single widget grid — respects visible_widgets order from preferences */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, alignItems: "stretch" }}>
          {prefs.visible_widgets.map((widgetId) => {
            switch (widgetId) {
              case "health":
                return (
                  <Suspense key="health" fallback={<WidgetSkeleton title="Health" lines={3} />}>
                    <HealthSummaryWidget userId={user.id} />
                  </Suspense>
                );
              case "weather":
                return prefs.latitude != null && prefs.longitude != null ? (
                  <Suspense key="weather" fallback={<WidgetSkeleton title="Weather" />}>
                    <WeatherWidget lat={prefs.latitude} lon={prefs.longitude} locationName={prefs.location_name ?? ""} />
                  </Suspense>
                ) : null;
              case "reminders":
                return <RemindersWidget key="reminders" initialReminders={reminders} tz={userTz} categories={prefs.reminder_categories} />;
              case "todos":
                return <TodosWidget key="todos" initialTodos={todos} />;
              case "stocks":
                return (
                  <Suspense key="stocks" fallback={<WidgetSkeleton title="Stocks" />}>
                    <StocksWidget tickers={prefs.stock_tickers} />
                  </Suspense>
                );
              case "lly_news":
                return (
                  <Suspense key="lly_news" fallback={<WidgetSkeleton title="LLY news" />}>
                    <LLYNewsWidget />
                  </Suspense>
                );
              case "news":
                return (
                  <Suspense key="news" fallback={<WidgetSkeleton title="News" lines={4} />}>
                    <NewsWidget topics={prefs.news_topics} />
                  </Suspense>
                );
              case "tips":
                return (
                  <Suspense key="tips" fallback={<WidgetSkeleton title="Claude tips" lines={3} />}>
                    <ClaudeTipCard />
                  </Suspense>
                );
              default:
                return null;
            }
          })}
        </div>
      </main>
    </div>
  );
}

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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20, color: "var(--color-ink)" }}>{title}</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          loading…
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 14,
              background: "var(--color-paper-deep)",
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

