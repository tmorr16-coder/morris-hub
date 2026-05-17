export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import SignOutButton from "./_components/SignOutButton";
import HubChat from "./_components/HubChat";
import WeatherWidget from "./_components/WeatherWidget";
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

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];
  const today = new Date();
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

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
            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
          <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05 }}>
            {greeting},
            <br />
            <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>{firstName}.</span>
          </h1>
        </section>

        {/* App tiles */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader label="Apps" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <AppTile href="https://health.morrisai.family" icon="◐" accent="#4D6B3A" title="Health" description="Workouts, sleep, nutrition, AI coach" />
            <AppTile href="https://finance.morrisai.family" icon="◑" accent="#8B6A47" title="Finance" description="Accounts, transactions, insights" />
            <AppTile href="#" icon="◒" accent="var(--color-ink-3)" title="Coming soon" description="More apps as you build them" disabled />
          </div>
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

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
      {label}
    </div>
  );
}

function AppTile({ href, icon, accent, title, description, disabled }: { href: string; icon: string; accent: string; title: string; description: string; disabled?: boolean }) {
  const inner = (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        gap: 14,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "var(--color-bg-deep)",
          color: accent,
          fontSize: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="serif" style={{ fontSize: 20 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>{description}</div>
      </div>
      {!disabled && <div style={{ color: "var(--color-ink-3)", fontSize: 18, flexShrink: 0 }}>→</div>}
    </div>
  );
  if (disabled) return inner;
  return (
    <a href={href} style={{ textDecoration: "none" }}>{inner}</a>
  );
}
