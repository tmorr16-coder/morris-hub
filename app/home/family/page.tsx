export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getAllUpcomingReminders } from "@/lib/reminders";
import { getFamilyCalendarEvents, getWeekRange } from "@/lib/familyCalendar";
import PlatformMenu from "@/components/PlatformMenu";
import ShoppingList from "./_components/ShoppingList";
import HouseholdGoals from "./_components/HouseholdGoals";
import MealPlan from "./_components/MealPlan";
import CommunityFeed from "./_components/CommunityFeed";
import CalendarClient from "./calendar/_components/CalendarClient";

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
  career:           "Career",
};

const MODULE_LINKS: Record<string, { label: string; href: string; color: string }> = {
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

  const [prefs, reminders, profileResult, careerGoalsResult, circleResult, pendingResult] = await Promise.all([
    getPreferences(user.id),
    getAllUpcomingReminders(user.id),
    service.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    service
      .schema("career")
      .from("career_goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    // My family circle members (include role for Kids section)
    service.schema("hub").from("family_members")
      .select("id, member_user_id, role, display_name, nickname, birth_year")
      .eq("user_id", user.id),
    // Pending invites addressed to me
    service.schema("hub").from("family_invitations")
      .select("id, inviter_id, display_name, role")
      .eq("invite_email", user.email?.toLowerCase() ?? "")
      .eq("status", "pending"),
  ]);

  // Enrich with auth user data for display
  const memberIds = ((circleResult.data ?? []) as { member_user_id: string }[]).map((m) => m.member_user_id);
  const inviterIds = ((pendingResult.data ?? []) as { inviter_id: string }[]).map((i) => i.inviter_id);
  const allIds = [...new Set([...memberIds, ...inviterIds])];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap = new Map<string, { full_name: string | null; email: string | null; avatar_url: string | null }>();
  if (allIds.length > 0) {
    const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (users?.users ?? []) as any[]) {
      userMap.set(u.id, {
        full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        email: u.email ?? null,
        avatar_url: u.user_metadata?.avatar_url ?? null,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familyMembers = ((circleResult.data ?? []) as any[]).map((m) => ({
    id: m.id,
    member_user_id: m.member_user_id,
    role: m.role ?? "adult",
    display_name: m.display_name ?? m.nickname ?? null,
    birth_year: m.birth_year ?? null,
    ...userMap.get(m.member_user_id),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingInvites = ((pendingResult.data ?? []) as any[]).map((inv) => ({
    id: inv.id,
    inviter_name: userMap.get(inv.inviter_id)?.full_name ?? userMap.get(inv.inviter_id)?.email ?? "Someone",
    role: inv.role,
  }));

  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";
  const activeCareerGoals: number = careerGoalsResult.count ?? 0;
  const today = new Date();

  // ── Phase 2b: Household reminders from ALL family circle members ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let householdReminders: any[] = [];
  if (memberIds.length > 0) {
    const horizon = new Date(today.getTime() + 30 * 86_400_000).toISOString();
    const { data: hwData } = await service
      .schema("hub")
      .from("reminders")
      .select("id, title, due_at, category, user_id, assigned_to")
      .eq("is_household", true)
      .is("completed_at", null)
      .in("user_id", memberIds)
      .lte("due_at", horizon)
      .order("due_at", { ascending: true });
    householdReminders = hwData ?? [];
  }

  // ── Household mode: shopping list, household goals, meal plan ──────────────
  const circleIds = [user.id, ...memberIds];
  const mealHorizonStr = today.toLocaleDateString("sv", { timeZone: userTz });
  const [shoppingResult, goalsResult, mealsResult] = await Promise.all([
    service.schema("hub").from("shopping_items")
      .select("id, item, quantity, checked, added_by, created_at")
      .in("circle_owner_id", circleIds)
      .order("created_at", { ascending: true }),
    service.schema("hub").from("household_goals")
      .select("id, title, description, target_date, status, created_by, created_at")
      .in("circle_owner_id", circleIds)
      .order("created_at", { ascending: false }),
    service.schema("hub").from("meal_plan")
      .select("id, date, meal_type, name, notes, created_by, created_at")
      .in("circle_owner_id", circleIds)
      .gte("date", mealHorizonStr)
      .order("date", { ascending: true }),
  ]);
  const shoppingItems = shoppingResult.data ?? [];
  const householdGoals = goalsResult.data ?? [];
  const mealPlan = mealsResult.data ?? [];

  const childMembers = familyMembers.filter((m) => m.role === "child");
  const todayStr = today.toLocaleDateString("sv", { timeZone: userTz });

  // ── Embedded week calendar ──────────────────────────────────────────
  const { start: weekStart, end: weekEnd } = getWeekRange(todayStr);
  const { events: weekCalendarEvents, members: calendarMembers } =
    await getFamilyCalendarEvents(user.id, weekStart, weekEnd, userTz);

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

  const myUserId = user.id;
  function nameForId(id: string): string {
    if (id === myUserId) return "You";
    return familyMembers.find((m) => m.member_user_id === id)?.display_name
      ?? userMap.get(id)?.full_name
      ?? "Family";
  }
  const circleNameMap: Record<string, string> = {};
  for (const id of circleIds) circleNameMap[id] = nameForId(id);

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

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, margin: "0 0 8px" }}>
              Family
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, fontFamily: "var(--font-geist, system-hub), sans-serif" }}>
              Household schedule, shared responsibilities, and family circle.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a
              href="/home/family/preview"
              style={{
                padding: "7px 16px", borderRadius: 9, border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)", color: "var(--color-ink-3)",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              Preview as…
            </a>
            <a
              href="/home/family/calendar"
              style={{
                padding: "7px 16px", borderRadius: 9, border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)", color: "var(--color-accent)",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              Full calendar →
            </a>
          </div>
        </div>

        {/* ── Pending invitations ── */}
        {pendingInvites.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {pendingInvites.map((inv) => (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: "rgba(59,92,127,0.06)", border: "1px solid var(--color-accent-soft)",
                borderRadius: 12, marginBottom: 8,
              }}>
                <span style={{ fontSize: 20 }}>💌</span>
                <div style={{ flex: 1, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                    {inv.inviter_name} invited you to their family circle
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
                    Role: {inv.role} · Accept or decline in
                    <a href="/home/settings/family" style={{ color: "var(--color-accent)", marginLeft: 4, textDecoration: "none" }}>Family Settings →</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Family circle members ── */}
        {familyMembers.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
              Family circle — {familyMembers.length}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {familyMembers.map((m) => {
                const name = m.display_name ?? m.full_name ?? m.email ?? "Member";
                const initial = name.slice(0, 1).toUpperCase();
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--color-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--color-accent)", flexShrink: 0 }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{name}</span>
                      {m.email && name !== m.email && (
                        <span style={{ fontSize: 11, color: "var(--color-ink-4)", marginLeft: 8 }}>{m.email}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 8, background: m.role === "child" ? "rgba(107,91,149,0.1)" : "rgba(59,92,127,0.08)", color: m.role === "child" ? "#6B5B95" : "var(--color-accent)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                      {m.role === "child" ? "Child" : "Adult"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Shopping, Household goals, Meal plan ── */}
        <ShoppingList initialItems={shoppingItems} userId={user.id} nameMap={circleNameMap} />
        <HouseholdGoals initialGoals={householdGoals} userId={user.id} nameMap={circleNameMap} />
        <MealPlan initialMeals={mealPlan} userId={user.id} />

        {/* ── Household tasks from all circle members ── */}
        {householdReminders.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
              Household tasks
            </h2>
            <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
              {householdReminders.map((r) => {
                const assigneeName = r.assigned_to
                  ? familyMembers.find((m) => m.member_user_id === r.assigned_to)?.display_name
                    ?? familyMembers.find((m) => m.member_user_id === r.assigned_to)?.full_name
                    ?? "A member"
                  : null;
                const ownerName = familyMembers.find((m) => m.member_user_id === r.user_id)?.display_name
                  ?? familyMembers.find((m) => m.member_user_id === r.user_id)?.full_name
                  ?? "Family";
                const dueStr = new Date(r.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: userTz });
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--color-rule-soft)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: WEEK_DOT[r.category] ?? "#E07B39", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif", flex: 1 }}>{r.title}</span>
                    <span style={{ fontSize: 10, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif", flexShrink: 0 }}>
                      {assigneeName ? `→ ${assigneeName}` : ownerName} · {dueStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Community — household workout/meal activity, moved from Health ── */}
        <CommunityFeed />

        {/* ── Children — slim summary, full profiles live at /children ── */}
        {childMembers.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderLeft: "3px solid #6B5B95", borderRadius: 12, padding: "14px 18px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                {childMembers.length} child{childMembers.length !== 1 ? "ren" : ""}
              </span>
              <a href="/children" style={{ fontSize: 12, fontWeight: 600, color: "#6B5B95", textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                Manage →
              </a>
            </div>
          </div>
        )}

        {/* ── Calendar — embedded week view, full month at /home/family/calendar ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Calendar
          </h2>
          <CalendarClient
            embedded
            view="week"
            anchorDate={todayStr}
            todayStr={todayStr}
            rangeStart={weekStart}
            rangeEnd={weekEnd}
            events={weekCalendarEvents}
            members={calendarMembers.map((m) => ({ id: m.id, label: m.label }))}
          />
        </div>

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

        {/* Family circle management link */}
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Family circle
        </h2>
        <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "16px 20px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", margin: 0, lineHeight: 1.5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            {familyMembers.length === 0
              ? "Invite family members to start sharing schedules and household responsibilities."
              : `${familyMembers.length} member${familyMembers.length !== 1 ? "s" : ""} in your circle. Manage roles and invitations in settings.`}
          </p>
          <a href="/home/settings/family" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 600 }}>
            {familyMembers.length === 0 ? "Invite someone →" : "Manage circle →"}
          </a>
        </div>

      </main>
    </div>
  );
}
