export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { renderWidget } from "@/app/home/_lib/renderWidget";
import { WIDGET_LABELS } from "@/app/home/settings/_components/SettingsForm";

const NEWS_PAGE_WIDGETS = new Set(["news", "city_news", "lly_news", "news_subscriptions", "sports"]);

export default async function NewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  const newsWids = prefs.visible_widgets.filter((w) => NEWS_PAGE_WIDGETS.has(w));

  const ctx = {
    prefs,
    todos: [],
    reminders: null,
    userTz: "America/Indiana/Indianapolis",
    activeCareerGoals: 0,
    user,
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, margin: "0 0 8px" }}>News</h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Your topics, subscriptions, sports, and company news.
          </p>
        </div>
        <Link href="/home/settings" style={{
          fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none",
          border: "1px solid var(--color-rule)", borderRadius: 8, padding: "7px 14px",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}>
          Customize →
        </Link>
      </div>

      {newsWids.length === 0 ? (
        <div style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12,
          padding: "24px 28px", textAlign: "center",
        }}>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 14, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            You&apos;ve turned off all news widgets.
          </p>
          <Link href="/home/settings" style={{
            fontSize: 13, fontWeight: 600, color: "var(--color-accent)", textDecoration: "none",
            fontFamily: "var(--font-geist, system-ui), sans-serif",
          }}>
            Enable some in Settings →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {newsWids.map((widgetId) => (
            <section key={widgetId} aria-label={WIDGET_LABELS[widgetId]}>
              {renderWidget(widgetId, ctx)}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
