import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BIBLE_BOOKS } from "@/lib/bible-api";
import { LargeTitle, Group, Cell, IconBadge, AskMorrisPill, HeatStrip, Icons } from "@/components/ios";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [plansRes, completionsRes, notesRes, challengesRes] = await Promise.all([
    db.schema("bible").from("user_plans").select("*, plan:reading_plans(*)").eq("user_id", user.id).order("started_at", { ascending: false }).limit(3),
    db.schema("bible").from("reading_completions").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(60),
    db.schema("bible").from("notes").select("id, reference, content, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    db.schema("bible").from("challenges").select("*, plan:reading_plans(title)").eq("is_active", true).limit(3),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userPlans = (plansRes.data ?? []) as any[];
  const streak = computeStreak(completionsRes.data ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedDays = new Set(((completionsRes.data ?? []) as any[]).map((c) => c.completed_at.slice(0, 10)));
  const heatBase = new Date().getTime();
  const heatDays = Array.from({ length: 70 }, (_, i) => ({
    level: completedDays.has(new Date(heatBase - (69 - i) * 86_400_000).toISOString().slice(0, 10)) ? 1 : 0,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentNotes = (notesRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const challenges = (challengesRes.data ?? []) as any[];

  const firstName = (user.user_metadata?.full_name ?? user.email ?? "friend").split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const todayBook = BIBLE_BOOKS[Math.floor(new Date().getTime() / 86_400_000) % BIBLE_BOOKS.length];

  return (
    <div className="ios-scroll">
      <LargeTitle brand title="Bible" subtitle={`Good ${getTimeOfDay()}, ${firstName} · ${dateLabel}`} avatarInitial={firstName[0]?.toUpperCase()} />

      {/* Streak hero — number + 10-week heatmap */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: "16px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Reading streak</div>
            <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.05, marginTop: 2, color: "var(--ios-orange)" }}>{streak} {streak === 1 ? "day" : "days"}</div>
          </div>
          <Icons.SparkleIcon aria-hidden style={{ width: 30, height: 30, color: "var(--ios-orange)" }} />
        </div>
        <HeatStrip days={heatDays} color="var(--ios-orange)" weeks={10} />
      </div>

      <Group header="Start reading">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.BookIcon /></IconBadge>} title="Continue where I left off" href="/bible/read" />
        <Cell lead={<IconBadge color="#3B5C7F"><Icons.BookIcon /></IconBadge>} title={`${todayBook.name} 1`} subtitle="Today's book" href={`/bible/read/${todayBook.id}/1`} />
        <Cell lead={<IconBadge color="#6B5B95"><Icons.BookIcon /></IconBadge>} title="John 3" href="/bible/read/JHN/3" />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.BookIcon /></IconBadge>} title="Psalms 23" href="/bible/read/PSA/23" />
      </Group>

      {userPlans.length > 0 ? (
        <Group header="Your plans">
          {userPlans.map((p) => (
            <Cell
              key={p.id}
              lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>}
              title={p.plan?.title ?? "Reading plan"}
              subtitle={p.plan?.duration_days ? `${p.plan.duration_days} days` : undefined}
              href={`/bible/plans/${p.plan_id}`}
            />
          ))}
        </Group>
      ) : (
        <Group header="Plans" footer="A plan keeps a daily rhythm to your reading.">
          <Cell lead={<IconBadge color="var(--ios-green)"><Icons.PlusIcon /></IconBadge>} title="Start a reading plan" href="/bible/plans" />
        </Group>
      )}

      {challenges.length > 0 && (
        <Group header="Challenges">
          {challenges.map((c) => (
            <Cell key={c.id} lead={<IconBadge color="var(--ios-orange)"><Icons.SparkleIcon /></IconBadge>} title={c.title} subtitle={c.plan?.title} href="/bible/challenges" />
          ))}
        </Group>
      )}

      {recentNotes.length > 0 && (
        <Group header="Recent notes">
          {recentNotes.slice(0, 4).map((n) => (
            <Cell key={n.id} lead={<IconBadge color="#5E5CE6"><Icons.ComposeIcon /></IconBadge>} title={n.reference || "Note"} subtitle={n.content} href="/bible/notes" />
          ))}
        </Group>
      )}

      <Group header="Study">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Ask about a passage" subtitle="AI study companion" href="/bible/chat" />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.BookIcon /></IconBadge>} title="Search Scripture" href="/bible/search" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Settings" href="/bible/settings" />
      </Group>

      <AskMorrisPill placeholder="Ask about today's reading…" href="/bible/chat" />

      <div style={{ height: 12 }} />
    </div>
  );
}

function computeStreak(completions: { completed_at: string }[]): number {
  if (!completions.length) return 0;
  const days = [...new Set(completions.map((c) => c.completed_at.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86_400_000;
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
