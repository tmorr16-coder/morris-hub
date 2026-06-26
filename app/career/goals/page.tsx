export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

interface MilestoneCount {
  goal_id: string;
  count: number;
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

  const shortGoals = goals.filter((g) => g.horizon === "short-term");
  const mediumGoals = goals.filter((g) => g.horizon === "medium-term");
  const longGoals = goals.filter((g) => g.horizon === "long-term");

  // Category summary
  const categoryCounts: Record<string, number> = {};
  for (const g of goals) {
    categoryCounts[g.category] = (categoryCounts[g.category] ?? 0) + 1;
  }
  const total = goals.length;

  return (
    <div data-section="career">
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 40,
          }}
        >
          <div>
            <Link
              href="/career"
              style={{ fontSize: 12, color: "var(--color-ink-3, #8a8278)", textDecoration: "none" }}
            >
              ← Career
            </Link>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 40,
                fontWeight: 400,
                margin: "8px 0 0",
                color: "var(--color-ink)",
              }}
            >
              Goals
            </h1>
          </div>
          <Link
            href="/career/goals/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              background: "var(--color-accent)",
              color: "#fff",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              marginTop: 28,
            }}
          >
            + New goal
          </Link>
        </div>

        {/* Category summary */}
        {total > 0 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 36,
              flexWrap: "wrap",
            }}
          >
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <div
                key={cat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: "var(--color-bg-raised, #fff)",
                  border: "1px solid var(--color-line, #e5e2da)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--color-ink-2)" }}>{cat}</span>
                <span
                  style={{
                    background: "var(--color-accent-soft, #dde5ee)",
                    color: "var(--color-accent)",
                    borderRadius: 4,
                    padding: "1px 7px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {Math.round((count / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Three-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <GoalColumn
            label="Short-term"
            subtitle="0 – 6 months"
            goals={shortGoals}
            milestoneCounts={milestoneCounts}
          />
          <GoalColumn
            label="Medium-term"
            subtitle="6 – 24 months"
            goals={mediumGoals}
            milestoneCounts={milestoneCounts}
          />
          <GoalColumn
            label="Long-term"
            subtitle="2 years+"
            goals={longGoals}
            milestoneCounts={milestoneCounts}
          />
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GoalColumn({
  label,
  subtitle,
  goals,
  milestoneCounts,
}: {
  label: string;
  subtitle: string;
  goals: Goal[];
  milestoneCounts: Record<string, number>;
}) {
  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "2px solid var(--color-accent)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-ink)",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-ink-3, #8a8278)" }}>{subtitle}</div>
      </div>
      {goals.length === 0 ? (
        <div
          style={{
            padding: "20px 16px",
            background: "var(--color-bg-sunk, #f0ede6)",
            borderRadius: 8,
            textAlign: "center",
            fontSize: 13,
            color: "var(--color-ink-4, #b8af9f)",
          }}
        >
          No goals yet
          <br />
          <Link
            href="/career/goals/new"
            style={{ color: "var(--color-accent)", fontSize: 12, marginTop: 6, display: "block" }}
          >
            + Add one
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              milestoneCount={milestoneCounts[goal.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, milestoneCount }: { goal: Goal; milestoneCount: number }) {
  const color = goal.color_tag ?? "var(--color-accent)";
  const progress = Math.min(100, Math.max(0, goal.progress_pct ?? 0));

  const horizonColors: Record<string, string> = {
    "short-term": "#4a6b3a",
    "medium-term": "#7a5a2a",
    "long-term": "#3a4a6b",
  };
  const horizonBgs: Record<string, string> = {
    "short-term": "#e6f0e0",
    "medium-term": "#f5eede",
    "long-term": "#e0e6f0",
  };

  return (
    <Link href={`/career/goals/${goal.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: "var(--color-bg-raised, #fff)",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid var(--color-line, #e5e2da)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          borderLeft: `4px solid ${color}`,
        }}
      >
        <div style={{ padding: "14px 16px" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-ink)",
              marginBottom: 8,
              lineHeight: 1.3,
            }}
          >
            {goal.title}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            <Badge bg="var(--color-accent-soft, #dde5ee)" text="var(--color-accent)">
              {goal.category}
            </Badge>
            <Badge
              bg={horizonBgs[goal.horizon] ?? "#f0ede6"}
              text={horizonColors[goal.horizon] ?? "#8a8278"}
            >
              {goal.horizon}
            </Badge>
            <StatusBadge status={goal.status} />
          </div>

          {goal.target_date && (
            <div
              style={{
                fontSize: 11,
                color: "var(--color-ink-3, #8a8278)",
                marginBottom: 10,
              }}
            >
              Target:{" "}
              {new Date(goal.target_date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}

          {/* Progress bar */}
          <div
            style={{
              height: 5,
              background: "var(--color-line, #e5e2da)",
              borderRadius: 3,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: color,
                borderRadius: 3,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--color-ink-3, #8a8278)",
            }}
          >
            <span>{progress}% complete</span>
            {milestoneCount > 0 && (
              <span>
                {milestoneCount} milestone{milestoneCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Badge({
  bg,
  text,
  children,
}: {
  bg: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "capitalize",
        background: bg,
        color: text,
      }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    active: { bg: "#e6f0e6", text: "#3a6b3a" },
    paused: { bg: "#f5f0e6", text: "#8a6a2a" },
    completed: { bg: "#e6eaf0", text: "#3a4a6b" },
  };
  const c = map[status] ?? { bg: "#f0ede6", text: "#8a8278" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "capitalize",
        background: c.bg,
        color: c.text,
      }}
    >
      {status}
    </span>
  );
}
