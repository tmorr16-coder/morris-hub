export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

interface Goal {
  id: string;
  title: string;
  category: string;
  horizon: string;
  target_date: string | null;
  progress_pct: number;
  status: string;
  color_tag: string | null;
  description: string | null;
}

const HORIZONS = [
  { key: "short-term", label: "Short-term", sub: "0 – 6 months" },
  { key: "medium-term", label: "Medium-term", sub: "6 – 24 months" },
  { key: "long-term", label: "Long-term", sub: "2 years+" },
];

function fmtTarget(d: string | null): string | null {
  return d
    ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
}

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [goalsRes, milestonesRes] = await Promise.all([
    db
      .schema("career")
      .from("career_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("target_date", { ascending: true }),
    db
      .schema("career")
      .from("career_milestones")
      .select("goal_id")
      .eq("user_id", user.id),
  ]);

  const goals: Goal[] = goalsRes.data ?? [];
  const milestoneRows: { goal_id: string }[] = milestonesRes.data ?? [];

  // Count milestones per goal
  const milestoneCounts: Record<string, number> = {};
  for (const row of milestoneRows) {
    milestoneCounts[row.goal_id] = (milestoneCounts[row.goal_id] ?? 0) + 1;
  }

  return (
    <div className="ios-scroll">
      <LargeTitle
        title="Goals"
        subtitle="Your development goals by horizon"
        avatarInitial={(user.user_metadata?.full_name ?? "T")[0]}
      />

      <Group>
        <Cell
          lead={
            <IconBadge color="var(--ios-tint)">
              <Icons.PlusIcon />
            </IconBadge>
          }
          title="New goal"
          href="/career/goals/new"
        />
      </Group>

      {goals.length === 0 && (
        <Group header="Goals" footer="Set a goal to start tracking your development.">
          <Cell
            lead={
              <IconBadge color="var(--ios-tint)">
                <Icons.BriefcaseIcon />
              </IconBadge>
            }
            title="Add your first goal"
            href="/career/goals/new"
          />
        </Group>
      )}

      {HORIZONS.map((h) => {
        const gs = goals.filter((g) => g.horizon === h.key);
        if (!gs.length) return null;
        return (
          <Group key={h.key} header={h.label} footer={h.sub}>
            {gs.map((g) => {
              const pct = Math.min(100, Math.max(0, g.progress_pct ?? 0));
              const mcount = milestoneCounts[g.id] ?? 0;
              return (
                <Cell
                  key={g.id}
                  href={`/career/goals/${g.id}`}
                  lead={
                    <IconBadge color={g.color_tag || "var(--ios-tint)"}>
                      <Icons.BriefcaseIcon />
                    </IconBadge>
                  }
                  title={g.title}
                  subtitle={
                    [g.category, fmtTarget(g.target_date)].filter(Boolean).join(" · ") || undefined
                  }
                  trailing={
                    <span
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 2,
                      }}
                    >
                      <span className="ios-num">{pct}%</span>
                      {mcount > 0 && (
                        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                          {mcount} milestone{mcount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  }
                />
              );
            })}
          </Group>
        );
      })}

      <div style={{ height: 12 }} />
    </div>
  );
}
