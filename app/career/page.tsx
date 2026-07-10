export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Group, Cell, IconBadge, GlanceGrid, GlanceTile, AskMorrisPill, BarRows, Icons } from "@/components/ios";

interface Goal {
  id: string; title: string; category: string | null; horizon: string;
  target_date: string | null; progress_pct: number | null; status: string; color_tag: string | null;
}
interface Relationship { relationship_type: string | null }
interface LearningItem { status: string }

const HORIZONS = [
  { key: "short-term", label: "Short-term" },
  { key: "medium-term", label: "Medium-term" },
  { key: "long-term", label: "Long-term" },
];

function fmtTarget(d: string | null): string | null {
  return d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
}

export default async function CareerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const ninety = new Date(); ninety.setDate(ninety.getDate() - 90);
  const thirty = new Date(); thirty.setDate(thirty.getDate() - 30);

  const [goalsRes, expCountRes, relsRes, learningRes, exp90Res] = await Promise.all([
    db.schema("career").from("career_goals").select("*").eq("user_id", user.id).order("target_date", { ascending: true }),
    db.schema("career").from("career_experiences").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("experience_date", thirty.toISOString().split("T")[0]),
    db.schema("career").from("career_relationships").select("*").eq("user_id", user.id),
    db.schema("career").from("career_learning").select("*").eq("user_id", user.id).in("status", ["in_progress", "planned"]),
    db.schema("career").from("career_experiences").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("experience_date", ninety.toISOString().split("T")[0]),
  ]);

  const goals: Goal[] = goalsRes.data ?? [];
  const expCount30: number = expCountRes.count ?? 0;
  const relationships: Relationship[] = relsRes.data ?? [];
  const learning: LearningItem[] = learningRes.data ?? [];
  const expCount90: number = exp90Res.count ?? 0;
  const mentorCoachCount = relationships.filter((r) => r.relationship_type === "mentor" || r.relationship_type === "coach").length;
  const activeGoals = goals.filter((g) => g.status === "active");
  const learningInProgress = learning.filter((l) => l.status === "in_progress").length;

  return (
    <div className="ios-scroll">
      <LargeTitle brand title="Career" subtitle="Your development plan · 70 · 20 · 10" avatarInitial={(user.user_metadata?.full_name ?? "T")[0]} />

      <GlanceGrid>
        <GlanceTile label="Goals" value={activeGoals.length} sub="active" href="/career/goals" />
        <GlanceTile label="Experiences" value={expCount30} sub="last 30 days" href="/career/70" accent="var(--ios-green)" />
        <GlanceTile label="Mentors" value={mentorCoachCount} sub="& coaches" href="/career/20" accent="#B565A7" />
        <GlanceTile label="Learning" value={learningInProgress} sub="in progress" href="/career/10" accent="var(--ios-orange)" />
      </GlanceGrid>

      {/* 70 · 20 · 10 balance — dashboard hero */}
      <div className="ios-list" style={{ margin: "14px 16px 0", padding: "4px 0 6px" }}>
        <div className="ios-group-header" style={{ padding: "12px 16px 0" }}>70 · 20 · 10 balance</div>
        <BarRows
          items={[
            { label: "On-the-job", value: expCount90, display: `${expCount90} exp`, color: "#2E7D46" },
            { label: "Relationships", value: relationships.length, display: `${relationships.length}`, color: "#B5539C" },
            { label: "Learning", value: learning.length, display: `${learning.length}`, color: "#E08600" },
          ]}
        />
        <div className="ios-footnote" style={{ padding: "0 16px", color: "var(--ios-label-2)" }}>Experience, relationships &amp; learning · last 90 days</div>
      </div>

      <AskMorrisPill placeholder="Ask your career advisor…" href="/career/advisor" />

      {HORIZONS.map((h) => {
        const gs = goals.filter((g) => g.horizon === h.key).slice(0, 3);
        if (!gs.length) return null;
        return (
          <Group key={h.key} header={h.label}>
            {gs.map((g) => (
              <Cell
                key={g.id}
                href={`/career/goals/${g.id}`}
                lead={<IconBadge color={g.color_tag || "var(--ios-tint)"}><Icons.BriefcaseIcon /></IconBadge>}
                title={g.title}
                subtitle={[g.category, fmtTarget(g.target_date)].filter(Boolean).join(" · ") || undefined}
                trailing={g.progress_pct != null ? <span className="ios-num">{g.progress_pct}%</span> : undefined}
              />
            ))}
          </Group>
        );
      })}

      {activeGoals.length === 0 && (
        <Group header="Goals" footer="Set a goal to start tracking your development.">
          <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>} title="Add your first goal" href="/career/goals/new" />
        </Group>
      )}


      <Group header="Grow">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Advisor" subtitle="AI coaching on your resume & goals" href="/career/advisor" />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.BookIcon /></IconBadge>} title="Certifications" href="/career/certifications" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.ChartIcon /></IconBadge>} title="Timeline & milestones" href="/career/timeline" />
      </Group>

      <Group header="Profile & setup">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.PersonIcon /></IconBadge>} title="Profile & assessment" subtitle="Resume, title & career interest assessment" href="/career/profile" />
        <Cell lead={<IconBadge color="#0077B5"><Icons.BriefcaseIcon /></IconBadge>} title="Settings" subtitle="LinkedIn, notifications & LSAT" href="/career/settings" />
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
