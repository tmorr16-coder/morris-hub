import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BIBLE_BOOKS, KNOWN_VERSIONS, DEFAULT_VERSION_ID } from "@/lib/bible-api";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const db = createServiceClient() as any;

  // Load active plans for this user
  const { data: userPlans } = await db
    .schema("bible")
    .from("user_plans")
    .select("*, plan:reading_plans(*)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(3);

  // Load recent completions (streak info)
  const { data: completions } = await db
    .schema("bible")
    .from("reading_completions")
    .select("completed_at")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(60);

  // Compute streak
  const streak = computeStreak(completions ?? []);

  // Load recent notes
  const { data: recentNotes } = await db
    .schema("bible")
    .from("notes")
    .select("id, reference, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Active challenges
  const { data: challenges } = await db
    .schema("bible")
    .from("challenges")
    .select("*, plan:reading_plans(title)")
    .eq("is_active", true)
    .limit(3);

  const menuUser = {
    email: user.email,
    name: user.user_metadata?.full_name ?? user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  const todayBook = BIBLE_BOOKS[Math.floor((Date.now() / 86400000)) % BIBLE_BOOKS.length];

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: "var(--font-instrument-serif, serif)",
            fontSize: 28,
            fontWeight: 400,
            margin: "0 0 4px",
            color: "var(--color-ink)",
          }}>
            Good {getTimeOfDay()}, {menuUser.name?.split(" ")[0] ?? "friend"}.
          </h1>
          <p style={{ color: "var(--color-ink-3)", margin: 0, fontSize: 14 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Streak card */}
        <div style={{
          background: "var(--color-accent)",
          color: "#fff",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, fontWeight: 500 }}>Reading streak</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-instrument-serif, serif)" }}>
              {streak} {streak === 1 ? "day" : "days"}
            </div>
          </div>
          <div style={{ fontSize: 48 }}>🔥</div>
        </div>

        {/* Quick-read card */}
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 20,
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", marginBottom: 12 }}>
            Start reading
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Continue where I left off", href: "/read" },
              { label: `${todayBook.name} 1`, href: `/read/${todayBook.id}/1` },
              { label: "John 3", href: "/read/JHN/3" },
              { label: "Psalms 23", href: "/read/PSA/23" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{
                padding: "8px 14px",
                background: "var(--color-bg-deep)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--color-ink)",
                textDecoration: "none",
                fontWeight: 500,
              }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Active plans */}
        {(userPlans ?? []).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-2)", marginBottom: 10 }}>
              Your reading plans
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(userPlans ?? []).map((up: any) => (
                <Link key={up.plan_id} href={`/plans/${up.plan_id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 12,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: "var(--shadow-card)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-ink)" }}>{up.plan?.title}</div>
                      <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>{up.plan?.duration_days} days</div>
                    </div>
                    <span style={{ color: "var(--color-ink-4)", fontSize: 18 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(userPlans ?? []).length === 0 && (
          <div style={{
            background: "var(--color-accent-soft)",
            border: "1px solid var(--color-accent)",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 20,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>Start a reading plan</div>
            <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 14 }}>
              Choose from curated plans or let AI create one for you.
            </div>
            <Link href="/bible/plans" style={{
              display: "inline-block",
              padding: "8px 20px",
              background: "var(--color-accent)",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
            }}>
              Browse plans
            </Link>
          </div>
        )}

        {/* Challenges */}
        {(challenges ?? []).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-2)" }}>Active challenges</div>
              <Link href="/bible/challenges" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>View all</Link>
            </div>
            {(challenges ?? []).map((ch: any) => (
              <div key={ch.id} style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-rule)",
                borderRadius: 12,
                padding: "14px 18px",
                boxShadow: "var(--shadow-card)",
                marginBottom: 8,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>🏆 {ch.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>{ch.plan?.title}</div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Notes */}
        {(recentNotes ?? []).length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-2)" }}>Recent notes</div>
              <Link href="/bible/notes" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>All notes</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(recentNotes ?? []).map((note: any) => (
                <div key={note.id} style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  boxShadow: "var(--shadow-card)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)", marginBottom: 4 }}>{note.reference}</div>
                  <div style={{ fontSize: 13, color: "var(--color-ink-2)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {note.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function computeStreak(completions: { completed_at: string }[]): number {
  if (!completions.length) return 0;
  const days = [...new Set(completions.map((c) => c.completed_at.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
}
