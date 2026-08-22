export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { getFamilyCalendarEvents, getWeekRange } from "@/lib/familyCalendar";
import { getUserTimezone } from "@/lib/timezone";
import { LargeTitle, Group, Cell, IconBadge, TabBar, WeekStrip, Icons } from "@/components/ios";

function weekDayLabel(dateStr: string, today: Date, userTz: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const tomorrowStr = new Date(today.getTime() + 86_400_000).toLocaleDateString("sv", { timeZone: userTz });
  const todayStr = today.toLocaleDateString("sv", { timeZone: userTz });
  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// event category / module → SF-symbol-style icon + color
const EV: Record<string, { icon: React.ReactNode; color: string }> = {
  appointment: { icon: <Icons.CalendarIcon />, color: "var(--ios-orange)" },
  medication: { icon: <Icons.PillIcon />, color: "var(--ios-green)" },
  workout: { icon: <Icons.DumbbellIcon />, color: "var(--ios-green)" },
  health: { icon: <Icons.HeartIcon />, color: "var(--ios-green)" },
  bill: { icon: <Icons.WalletIcon />, color: "var(--ios-finance)" },
  finance: { icon: <Icons.WalletIcon />, color: "var(--ios-finance)" },
  course: { icon: <Icons.BookIcon />, color: "var(--ios-tint)" },
  general: { icon: <Icons.BellIcon />, color: "var(--ios-tint)" },
};
const evStyle = (k: string) => EV[k] ?? EV.general;

const MEMBER_COLORS = ["var(--ios-tint)", "#B565A7", "#E8607A", "#34A56F", "#C97A3A", "#5E5CE6"];

function Avatar({ color, initial }: { color: string; initial: string }) {
  return (
    <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
      {initial}
    </span>
  );
}

export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userTz = getUserTimezone(user.user_metadata);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [circleResult, pendingResult] = await Promise.all([
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

  // Enrich with auth user data for display. Filter out null member_user_ids
  // (managed children have none) — a null in a later .in(circleIds) list breaks
  // the shared-lists queries, which made them read as empty.
  const memberIds = ((circleResult.data ?? []) as { member_user_id: string | null }[])
    .map((m) => m.member_user_id).filter((id): id is string => !!id);
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
  const { events: weekCalendarEvents } =
    await getFamilyCalendarEvents(user.id, weekStart, weekEnd, userTz);

  const myUserId = user.id;
  function nameForId(id: string): string {
    if (id === myUserId) return "You";
    return familyMembers.find((m) => m.member_user_id === id)?.display_name
      ?? userMap.get(id)?.full_name
      ?? "Family";
  }
  const circleNameMap: Record<string, string> = {};
  for (const id of circleIds) circleNameMap[id] = nameForId(id);

  // Group this-week calendar events by day
  const eventsByDate = new Map<string, typeof weekCalendarEvents>();
  for (const e of weekCalendarEvents) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, []);
    eventsByDate.get(e.date)!.push(e);
  }
  const weekDays = [...eventsByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 7);

  // 7-day week strip with per-day event dots
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekStripDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    const evs = eventsByDate.get(dateKey) ?? [];
    const dots = [...new Set(evs.map((e) => evStyle(e.category ?? e.module ?? "general").color))].slice(0, 3);
    return { label: WD[d.getUTCDay()], date: d.getUTCDate(), selected: dateKey === todayStr, dots };
  });

  const memberName = (m: (typeof familyMembers)[number]): string =>
    m.display_name ?? m.full_name ?? m.email ?? "Member";
  const uncheckedShopping = shoppingItems.filter((s: { checked?: boolean }) => !s.checked).length;
  const activeGoalsCount = householdGoals.filter((g: { status?: string }) => g.status !== "done" && g.status !== "completed").length;
  const nextMeal = mealPlan[0];
  const tabMembers = familyMembers.map((m) => ({ id: m.member_user_id, label: memberName(m) }));

  return (
    <div data-ui="ios">
      <div className="ios-scroll">
        <LargeTitle title="Family" subtitle="Your circle · this week" avatarInitial={(user.user_metadata?.full_name || user.email || "?")[0]?.toUpperCase()} />

        <div className="ios-list" style={{ margin: "8px 16px 0" }}>
          <WeekStrip days={weekStripDays} />
        </div>

        {pendingInvites.length > 0 && (
          <Group header="Invitations">
            {pendingInvites.map((inv) => (
              <Cell
                key={inv.id}
                href="/home/settings/family"
                lead={<IconBadge color="var(--ios-orange)"><Icons.PeopleIcon /></IconBadge>}
                title={`${inv.inviter_name} invited you`}
                subtitle={`Role: ${inv.role}`}
              />
            ))}
          </Group>
        )}

        {weekDays.map(([date, evs]) => (
          <Group key={date} header={weekDayLabel(date, today, userTz)}>
            {evs.slice(0, 6).map((e, i) => {
              const st = evStyle(e.category ?? e.module ?? "general");
              return (
                <Cell
                  key={`${date}-${i}`}
                  href={e.href || "/home/family/calendar"}
                  chevron={false}
                  lead={
                    <span style={{ display: "flex", alignItems: "center", gap: 8, width: 74 }}>
                      <span style={{ width: 4, height: 30, borderRadius: 2, background: st.color, flexShrink: 0 }} />
                      <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{e.timeLabel || "All day"}</span>
                    </span>
                  }
                  title={e.title}
                  subtitle={e.personLabel ?? undefined}
                />
              );
            })}
          </Group>
        ))}

        {weekDays.length === 0 && (
          <Group header="This week" footer="Nothing scheduled across your circle this week.">
            <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.CalendarIcon /></IconBadge>} title="Open the calendar" href="/home/family/calendar" />
          </Group>
        )}

        <Group header={`Members · ${familyMembers.length + 1}`} footer="Tap a member to see their schedule and tasks.">
          <Cell lead={<Avatar color={MEMBER_COLORS[0]} initial={(user.user_metadata?.full_name || user.email || "?")[0]?.toUpperCase() ?? "?"} />} title="You" href="/home/me" />
          {familyMembers.map((m, i) => (
            <Cell
              key={m.id}
              lead={<Avatar color={MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length]} initial={memberName(m)[0]?.toUpperCase() ?? "?"} />}
              title={memberName(m)}
              subtitle={m.role === "child" ? "Child" : "Adult"}
              href="/home/family/preview"
            />
          ))}
        </Group>

        <Group header="Shared">
          <Cell lead={<IconBadge color="#34A56F"><Icons.CartIcon /></IconBadge>} title="Shopping list" subtitle={shoppingItems.length ? `${uncheckedShopping} of ${shoppingItems.length} to buy` : "Empty"} trailing={shoppingItems.length ? String(uncheckedShopping) : undefined} href="/home/family/shopping" />
          <Cell lead={<IconBadge color="#E8734A"><Icons.ForkKnifeIcon /></IconBadge>} title="Meal plan" subtitle={nextMeal ? `Next · ${nextMeal.name}` : "Nothing planned"} href="/home/family/meals" />
          <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.ChecklistIcon /></IconBadge>} title="Household tasks" subtitle={householdReminders.length ? "due soon" : "All clear"} trailing={householdReminders.length ? String(householdReminders.length) : undefined} href="/home/tasks" />
          <Cell lead={<IconBadge color="#8E8E93"><Icons.HomeIcon /></IconBadge>} title="Household goals" subtitle={householdGoals.length ? "active" : "None yet"} trailing={activeGoalsCount ? String(activeGoalsCount) : undefined} href="/home/family/goals" />
        </Group>

        {childMembers.length > 0 && (
          <Group header="Children">
            <Cell lead={<IconBadge color="#E8607A"><Icons.PeopleIcon /></IconBadge>} title={`${childMembers.length} ${childMembers.length === 1 ? "child" : "children"}`} subtitle="Activities, school & tasks" href="/children" />
          </Group>
        )}

        <Group header="Family">
          <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.CalendarIcon /></IconBadge>} title="Full calendar" href="/home/family/calendar" />
          <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Manage circle" href="/home/settings/family" />
        </Group>

        <div style={{ height: 12 }} />
      </div>
      <TabBar current="family" members={tabMembers} currentUserId={user.id} sourceApp="family" />
    </div>
  );
}
