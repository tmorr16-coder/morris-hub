import type { ReactNode } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";
import { Group, IconBadge, Icons } from "@/components/ios";

function toDateStr(d: Date) { return d.toLocaleDateString("sv"); }

function relTime(iso: string): string {
  const mins = Math.floor((new Date().getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return "just now";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function CommunityFeed() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const now = new Date().getTime();
  const today   = toDateStr(new Date());
  const weekAgo = toDateStr(new Date(now - 7 * 86_400_000));
  const monthAgo = toDateStr(new Date(now - 30 * 86_400_000));

  const [
    { count: workoutsToday },
    { count: workoutsWeek },
    { count: mealsToday },
    { count: activeUsersWeek },
    { data: topTypes },
    { data: { users: authUsers } },
    { data: recentWorkouts },
  ] = await Promise.all([
    db.from("workout_sessions").select("id", { count: "exact", head: true }).eq("date", today),
    db.from("workout_sessions").select("id", { count: "exact", head: true }).gte("date", weekAgo),
    db.from("meals").select("id", { count: "exact", head: true }).eq("date", today),
    db.from("workout_sessions").select("user_id", { count: "exact", head: true }).gte("date", weekAgo),
    db.from("workout_sessions").select("type").gte("date", monthAgo).limit(200),
    // List all auth users via admin API
    db.auth.admin.listUsers({ perPage: 50 }),
    // Per-user last workout date + count for stats
    db.from("workout_sessions").select("user_id, date").gte("date", monthAgo).order("date", { ascending: false }),
  ]);

  // Most popular workout type this month
  const typeCounts: Record<string, number> = {};
  for (const row of (topTypes ?? [])) {
    const t = row.type as string;
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Per-user stats from recent workouts
  const userWorkoutMap = new Map<string, { count: number; lastDate: string }>();
  for (const row of (recentWorkouts ?? []) as { user_id: string; date: string }[]) {
    const existing = userWorkoutMap.get(row.user_id);
    if (!existing) {
      userWorkoutMap.set(row.user_id, { count: 1, lastDate: row.date });
    } else {
      existing.count++;
    }
  }

  // Build member list from auth users
  type AuthUser = { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string };
  const members = ((authUsers as AuthUser[]) ?? []).map((u) => {
    const meta = u.user_metadata ?? {};
    const stats = userWorkoutMap.get(u.id);
    return {
      id: u.id,
      name: meta.full_name ?? meta.name ?? (u.email?.split("@")[0] ?? "Member"),
      avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      workouts: stats?.count ?? 0,
      lastDate: stats?.lastDate ?? null,
      joinedAt: u.created_at,
    };
  }).sort((a, b) => (b.workouts - a.workouts));

  // Activity blurbs
  const items: { icon: ReactNode; color: string; text: string; sub?: string }[] = [];
  if ((workoutsToday ?? 0) > 0) items.push({ icon: <Icons.DumbbellIcon />, color: "var(--ios-green)", text: `${workoutsToday} workout${workoutsToday === 1 ? "" : "s"} logged today` });
  if ((workoutsWeek ?? 0) > 0) items.push({ icon: <Icons.CalendarIcon />, color: "var(--ios-tint)", text: `${workoutsWeek} sessions this week`, sub: `${activeUsersWeek ?? 0} active member${activeUsersWeek === 1 ? "" : "s"}` });
  if ((mealsToday ?? 0) > 0) items.push({ icon: <Icons.ForkKnifeIcon />, color: "var(--ios-green)", text: `${mealsToday} meal${mealsToday === 1 ? "" : "s"} tracked today` });
  if (topType) items.push({ icon: <Icons.TrendUpIcon />, color: "var(--ios-orange)", text: `Most popular: ${topType}`, sub: `${typeCounts[topType]} sessions this month` });
  if (items.length === 0) items.push({ icon: <Icons.PeopleIcon />, color: "var(--ios-tint)", text: "Be the first to log activity today!" });

  return (
    <Group
      header={
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Household activity</span>
          <span className="ios-num">{members.length} member{members.length !== 1 ? "s" : ""}</span>
        </span>
      }
    >
      {/* Activity blurbs */}
      {items.map((item, i) => (
        <div key={i} className="ios-cell">
          <span className="ios-cell-lead"><IconBadge color={item.color}>{item.icon}</IconBadge></span>
          <span className="ios-cell-body">
            <span className="ios-cell-title ios-subhead">{item.text}</span>
            {item.sub && <span className="ios-cell-sub">{item.sub}</span>}
          </span>
        </div>
      ))}

      {/* Members */}
      {members.map((m) => (
        <div key={m.id} className="ios-cell ios-cell--inset">
          <span className="ios-cell-lead">
            {m.avatarUrl ? (
              <Image src={m.avatarUrl} alt={m.name} width={30} height={30} style={{ borderRadius: "50%", flexShrink: 0 }} />
            ) : (
              <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                {m.name[0]?.toUpperCase()}
              </span>
            )}
          </span>
          <span className="ios-cell-body">
            <span className="ios-cell-title ios-subhead ios-truncate">{m.name}</span>
            <span className="ios-cell-sub">
              {m.workouts > 0 ? `${m.workouts} workout${m.workouts !== 1 ? "s" : ""} this month` : "No workouts yet"}
              {m.lastDate && ` · active ${relTime(m.lastDate + "T12:00:00")}`}
            </span>
          </span>
        </div>
      ))}
    </Group>
  );
}
