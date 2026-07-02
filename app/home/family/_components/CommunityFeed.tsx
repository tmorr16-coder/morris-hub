import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";

function toDateStr(d: Date) { return d.toLocaleDateString("sv"); }

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return "just now";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function CommunityFeed() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const today   = toDateStr(new Date());
  const weekAgo = toDateStr(new Date(Date.now() - 7 * 86_400_000));
  const monthAgo = toDateStr(new Date(Date.now() - 30 * 86_400_000));

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
  const items: { icon: string; text: string; sub?: string }[] = [];
  if ((workoutsToday ?? 0) > 0) items.push({ icon: "🏋️", text: `${workoutsToday} workout${workoutsToday === 1 ? "" : "s"} logged today` });
  if ((workoutsWeek ?? 0) > 0) items.push({ icon: "📅", text: `${workoutsWeek} sessions this week`, sub: `${activeUsersWeek ?? 0} active member${activeUsersWeek === 1 ? "" : "s"}` });
  if ((mealsToday ?? 0) > 0) items.push({ icon: "🥗", text: `${mealsToday} meal${mealsToday === 1 ? "" : "s"} tracked today` });
  if (topType) items.push({ icon: "🔥", text: `Most popular: ${topType}`, sub: `${typeCounts[topType]} sessions this month` });
  if (items.length === 0) items.push({ icon: "👋", text: "Be the first to log activity today!" });

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
        Community
      </h2>
      <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--color-rule-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Household activity</div>
          <div style={{ fontSize: 10, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{members.length} member{members.length !== 1 ? "s" : ""}</div>
        </div>

        {/* Activity blurbs */}
        <div style={{ borderBottom: "1px solid var(--color-rule-soft)" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < items.length - 1 ? "1px solid var(--color-rule-soft)" : undefined }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--color-bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{item.text}</div>
                {item.sub && <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{item.sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Members */}
        {members.length > 0 && (
          <div>
            <div style={{ padding: "10px 16px 6px", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
              Members
            </div>
            {members.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: i === 0 ? undefined : "1px solid var(--color-rule-soft)" }}>
                {m.avatarUrl ? (
                  <Image src={m.avatarUrl} alt={m.name} width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-ink)", color: "var(--color-bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {m.name[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                    {m.workouts > 0 ? `${m.workouts} workout${m.workouts !== 1 ? "s" : ""} this month` : "No workouts yet"}
                    {m.lastDate && ` · active ${relTime(m.lastDate + "T12:00:00")}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
