export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./_components/SignOutButton";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];
  const today = new Date();
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div>

      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--color-rule)",
          background: "var(--color-bg)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "16px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-accent)", alignSelf: "center" }} />
            <span className="serif" style={{ fontSize: 22 }}>morrisai</span>
            <span className="serif" style={{ color: "var(--color-accent-dark)", fontStyle: "italic" }}>.family</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 80px" }}>

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

        {/* ── App tiles ──────────────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader label="Apps" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <AppTile
              href="https://health.morrisai.family"
              icon="◐"
              accent="#4D6B3A"
              title="Health"
              description="Workouts, sleep, nutrition, AI coach"
            />
            <AppTile
              href="https://finance.morrisai.family"
              icon="◑"
              accent="#8B6A47"
              title="Finance"
              description="Accounts, transactions, insights"
            />
            <AppTile
              href="#"
              icon="◒"
              accent="var(--color-ink-3)"
              title="Coming soon"
              description="More apps as you build them"
              disabled
            />
          </div>
        </section>

        {/* ── Three-column widget grid ─────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <PlaceholderCard title="Today" subtitle="Weather + your day" />
          <PlaceholderCard title="To-dos" subtitle="What's on your plate" />
          <PlaceholderCard title="Stocks" subtitle="LLY + tech picks" />
        </div>

        {/* ── News + Claude tip — wider stacked ────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
          <PlaceholderCard title="News" subtitle="Politics · AI · Claude" big />
          <PlaceholderCard title="Claude tip" subtitle="Daily tip on using Claude well" big />
        </div>

      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--color-ink-3)",
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}

function AppTile({
  href,
  icon,
  accent,
  title,
  description,
  disabled,
}: {
  href: string;
  icon: string;
  accent: string;
  title: string;
  description: string;
  disabled?: boolean;
}) {
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
        transition: "transform 120ms, box-shadow 120ms",
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
        <div className="serif" style={{ fontSize: 20, color: "var(--color-ink)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>{description}</div>
      </div>
      {!disabled && (
        <div style={{ color: "var(--color-ink-3)", fontSize: 18, flexShrink: 0 }}>→</div>
      )}
    </div>
  );
  if (disabled) return inner;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      {inner}
    </a>
  );
}

function PlaceholderCard({ title, subtitle, big }: { title: string; subtitle: string; big?: boolean }) {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: big ? "20px 24px" : "18px 20px",
        boxShadow: "var(--shadow-card)",
        minHeight: big ? 200 : 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 className="serif" style={{ fontSize: big ? 22 : 18 }}>{title}</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Coming next
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 16 }}>{subtitle}</p>
      <div
        style={{
          height: big ? 100 : 60,
          background: "var(--color-bg-deep)",
          borderRadius: 8,
          opacity: 0.4,
        }}
      />
    </div>
  );
}
