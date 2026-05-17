export const dynamic = "force-dynamic";

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
import TodosWidget from "./_components/TodosWidget";
import NewsWidget from "./_components/NewsWidget";
import ClaudeTipCard from "./_components/ClaudeTipCard";
import type { Todo } from "./actions";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);

  // Fetch todos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: todoRows } = await service
    .schema("hub")
    .from("todos")
    .select("id, title, completed, notes, due_date, priority, created_at")
    .eq("user_id", user.id)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);
  const todos = (todoRows ?? []) as Todo[];

  const reminders = await getUpcomingReminders(user.id);

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

        {/* Three-column widget grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          {prefs.latitude != null && prefs.longitude != null && (
            <WeatherWidget lat={prefs.latitude} lon={prefs.longitude} locationName={prefs.location_name ?? ""} />
          )}
          <RemindersWidget initialReminders={reminders} tz={userTz} />
          <TodosWidget initialTodos={todos} />
          <StocksWidget tickers={prefs.stock_tickers} />
        </div>

        {/* News + Claude tip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
          <NewsWidget topics={prefs.news_topics} />
          <ClaudeTipCard />
        </div>
      </main>
    </div>
  );
}

