export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getAllUpcomingReminders } from "@/lib/reminders";
import PlatformMenu from "@/components/PlatformMenu";

const userTz = "America/Indiana/Indianapolis";

function weekDayLabel(dateStr: string, today: Date): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const tomorrowStr = new Date(today.getTime() + 86_400_000)
    .toLocaleDateString("sv", { timeZone: userTz });
  if (dateStr === tomorrowStr) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

const WEEK_DOT: Record<string, string> = {
  appointment: "var(--color-accent)",
  medication:  "#4D6B3A",
  workout:     "#C97A3A",
  bill:        "var(--color-amber)",
  personal:    "var(--color-ink-3)",
  general:     "var(--color-ink-3)",
};

const MODULE_LABEL: Record<string, string> = {
  health:           "Health",
  finance:          "Finance",
  "student-success":"Kids",
  career:           "Career",
};

const MODULE_LINKS: Record<string, { label: string; href: string; color: string }> = {
  "student-success": { label: "Kids →",    href: "/student-success",    color: "#6B5B95" },
  "health":          { label: "Health →",  href: "/health",             color: "#4D6B3A" },
  "finance":         { label: "Finance →", href: "/finance/dashboard",  color: "#8B6A47" },
  "investments":     { label: "Invest →",  href: "/investments",        color: "#C97A3A" },
  "career":          { label: "Career →",  href: "/career",             color: "#2A6049" },
};

export default async function FamilyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [prefs, reminders, profileResult, careerGoalsResult] = await Promise.all([
    getPreferences(user.id),
    getAllUpcomingReminders(user.id),
    service.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    service
      .schema("career")
      .from("career_goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";
  const activeCareerGoals: number = careerGoalsResult.count ?? 0;
  const today = new Date();
  const todayStr = today.toLocaleDateString("sv", { timeZone: userTz });

  // Week-ahead reminders grouped by day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcoming = (reminders as any[]).filter((r) => {
    if (r.completed_at) return false;
    const localDate = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
    return localDate > todayStr;
  });

  const byDay: Record<string, Array<{ id: string; title: string; category: string; source_app: string }>> = {};
  for (const r of upcoming) {
    const dateKey = new Date(r.due_at).toLocaleDateString("sv", { timeZone: userTz });
    if (!byDay[dateKey]) byDay[dateKey] = [];
    if (byDay[dateKey].length < 4) byDay[dateKey].push({ id: r.id, title: r.title, category: r.category, source_app: r.source_app });
  }

  const weekItems = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7);

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin,
    appAccess: prefs.app_access ?? null,
  };

  const accessibleModules = Object.entries(MODULE_LINKS).filter(
    ([key]) => !prefs.app_access?.length || prefs.app_access.includes(key)
  );

  return (
    <div>
      <PlatformMenu currentApp="family" user={menuUser} />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 100px" }}>

        <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, margin: "0 0 8px" }}>
          Family
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Household schedule, shared responsibilities, and family circle.
        </p>

        {/* Week-ahead */}
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          This week
        </h2>

        {weekItems.length > 0 ? (
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, boxShadow: "var(--shadow-card)", overflow: "hidden", marginBottom: 28 }}>
            {weekItems.map(([dateStr, items], di) => (
              <div key={dateStr}>
                <div style={{ padding: "9px 20px 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif", borderTop: di > 0 ? "1px solid var(--color-rule-soft)" : "none" }}>
                  {weekDayLabel(dateStr, today)}
                </div>
                {items.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: WEEK_DOT[item.category] ?? "var(--color-ink-3)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif", flex: 1 }}>{item.title}</span>
                    {MODULE_LABEL[item.source_app] && (
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-4)", flexShrink: 0 }}>{MODULE_LABEL[item.source_app]}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", marginBottom: 28, boxShadow: "var(--shadow-card)" }}>
            <p style={{ fontSize: 13, color: "var(--color-ink-4)", margin: 0, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Nothing coming up this week.</p>
          </div>
        )}

        {/* Module links */}
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Family modules
        </h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          {accessibleModules.map(([, { label, href, color }]) => (
            <a key={href} href={href} style={{ fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 20, border: `1px solid ${color}`, color, textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif", background: "var(--color-bg-card)" }}>
              {label}
            </a>
          ))}
          {activeCareerGoals > 0 && prefs.app_access?.includes("career") && (
            <a href="/career/goals" style={{ fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 20, border: "1px solid #2A6049", color: "#2A6049", textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif", background: "var(--color-bg-card)" }}>
              {activeCareerGoals} career goal{activeCareerGoals !== 1 ? "s" : ""} →
            </a>
          )}
        </div>

        {/* Family circle placeholder */}
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Family circle
        </h2>
        <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", margin: 0, lineHeight: 1.5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Members, invitations, assigned household tasks, and shared visibility coming in Phase 2.
          </p>
          <a href="/home/settings/family" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
            Manage circle →
          </a>
        </div>

      </main>
    </div>
  );
}
