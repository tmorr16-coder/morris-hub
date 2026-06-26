export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
export default async function CareerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const ninety = new Date();
  ninety.setDate(ninety.getDate() - 90);
  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);

  const [goalsRes, expCountRes, relsRes, learningRes, exp90Res] = await Promise.all([
    db
      .schema("career")
      .from("career_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("target_date", { ascending: true }),
    db
      .schema("career")
      .from("career_experiences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("experience_date", thirty.toISOString().split("T")[0]),
    db
      .schema("career")
      .from("career_relationships")
      .select("*")
      .eq("user_id", user.id),
    db
      .schema("career")
      .from("career_learning")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["in_progress", "planned"]),
    db
      .schema("career")
      .from("career_experiences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("experience_date", ninety.toISOString().split("T")[0]),
  ]);

  const goals: Goal[] = goalsRes.data ?? [];
  const expCount30: number = expCountRes.count ?? 0;
  const relationships: Relationship[] = relsRes.data ?? [];
  const learning: LearningItem[] = learningRes.data ?? [];
  const expCount90: number = exp90Res.count ?? 0;

  const mentorCoachCount = relationships.filter(
    (r) => r.relationship_type === "mentor" || r.relationship_type === "coach"
  ).length;

  const activeGoals = goals.filter((g) => g.status === "active");

  const shortGoals = goals.filter((g) => g.horizon === "short-term").slice(0, 3);
  const mediumGoals = goals.filter((g) => g.horizon === "medium-term").slice(0, 3);
  const longGoals = goals.filter((g) => g.horizon === "long-term").slice(0, 3);

  return (
    <div data-section="career">
      <main
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "40px 28px 80px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              marginBottom: 8,
            }}
          >
            70 · 20 · 10
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 44,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              margin: 0,
              color: "var(--color-ink)",
            }}
          >
            Career Development
          </h1>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <StatCard label="Active Goals" value={activeGoals.length} />
          <StatCard label="Experiences (30d)" value={expCount30} />
          <StatCard label="Mentors / Coaches" value={mentorCoachCount} />
          <StatCard label="Learning In Progress" value={learning.filter((l) => l.status === "in_progress").length} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 32,
            alignItems: "start",
          }}
        >
          {/* Goals overview */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 400,
                  margin: 0,
                  color: "var(--color-ink)",
                }}
              >
                Goals Overview
              </h2>
              <Link
                href="/career/goals/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "var(--color-accent)",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                + Add Goal
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <HorizonGroup
                label="Short-term"
                goals={shortGoals}
                totalCount={goals.filter((g) => g.horizon === "short-term").length}
                allHref="/career/goals?horizon=short-term"
              />
              <HorizonGroup
                label="Medium-term"
                goals={mediumGoals}
                totalCount={goals.filter((g) => g.horizon === "medium-term").length}
                allHref="/career/goals?horizon=medium-term"
              />
              <HorizonGroup
                label="Long-term"
                goals={longGoals}
                totalCount={goals.filter((g) => g.horizon === "long-term").length}
                allHref="/career/goals?horizon=long-term"
              />
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Quick actions */}
            <div
              style={{
                background: "var(--color-bg-raised, #fff)",
                border: "1px solid var(--color-line, #e5e2da)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3, #8a8278)",
                  marginBottom: 14,
                }}
              >
                Quick Actions
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <QuickLink href="/career/goals/new" label="Add Goal" icon="🎯" />
                <QuickLink href="/career/70" label="Log Experience" icon="💼" />
                <QuickLink href="/career/20" label="Add Mentor" icon="🤝" />
                <QuickLink href="/career/10" label="Add Learning" icon="📚" />
              </div>
            </div>

            {/* 70-20-10 balance */}
            <div
              style={{
                background: "var(--color-bg-raised, #fff)",
                border: "1px solid var(--color-line, #e5e2da)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3, #8a8278)",
                  marginBottom: 14,
                }}
              >
                70 · 20 · 10 Balance
              </div>
              <PillarBar
                label="70% On-the-job"
                count={expCount90}
                max={Math.max(expCount90, relationships.length, learning.length, 1)}
                color="var(--color-accent)"
              />
              <PillarBar
                label="20% Relationships"
                count={relationships.length}
                max={Math.max(expCount90, relationships.length, learning.length, 1)}
                color="var(--color-moss, #4a6a4d)"
              />
              <PillarBar
                label="10% Learning"
                count={learning.length}
                max={Math.max(expCount90, relationships.length, learning.length, 1)}
                color="var(--color-slate, #2f3a47)"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  category: string;
  horizon: string;
  target_date: string | null;
  progress_pct: number;
  status: string;
  color_tag: string | null;
}

interface Relationship {
  id: string;
  relationship_type: string;
}

interface LearningItem {
  id: string;
  status: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "var(--color-bg-raised, #fff)",
        border: "1px solid var(--color-line, #e5e2da)",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontFamily: "var(--font-display)",
          fontWeight: 400,
          color: "var(--color-accent)",
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-ink-3, #8a8278)", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function HorizonGroup({
  label,
  goals,
  totalCount,
  allHref,
}: {
  label: string;
  goals: Goal[];
  totalCount: number;
  allHref: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-ink-3, #8a8278)",
          }}
        >
          {label}
        </div>
        {totalCount > 3 && (
          <Link
            href={allHref}
            style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}
          >
            See all ({totalCount}) →
          </Link>
        )}
      </div>
      {goals.length === 0 ? (
        <div
          style={{
            padding: "16px 20px",
            background: "var(--color-bg-sunk, #f0ede6)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--color-ink-4, #b8af9f)",
          }}
        >
          No {label.toLowerCase()} goals yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const color = goal.color_tag ?? "var(--color-accent)";
  const progress = Math.min(100, Math.max(0, goal.progress_pct ?? 0));

  return (
    <Link
      href={`/career/goals/${goal.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          background: "var(--color-bg-raised, #fff)",
          border: "1px solid var(--color-line, #e5e2da)",
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          transition: "box-shadow 0.15s",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-ink)",
              marginBottom: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {goal.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <CategoryBadge category={goal.category} />
            {goal.target_date && (
              <span style={{ fontSize: 11, color: "var(--color-ink-4, #b8af9f)" }}>
                {new Date(goal.target_date).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            <StatusBadge status={goal.status} />
          </div>
          <ProgressBar progress={progress} color={color} />
        </div>
      </div>
    </Link>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: "var(--color-accent-soft, #dde5ee)",
        color: "var(--color-accent)",
      }}
    >
      {category}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: "#e6f0e6", text: "#3a6b3a" },
    paused: { bg: "#f5f0e6", text: "#8a6a2a" },
    completed: { bg: "#e6eaf0", text: "#3a4a6b" },
  };
  const c = colors[status] ?? { bg: "#f0ede6", text: "#8a8278" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.text,
      }}
    >
      {status}
    </span>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div
      style={{
        height: 4,
        background: "var(--color-line, #e5e2da)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: color,
          borderRadius: 2,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--color-bg-sunk, #f0ede6)",
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--color-ink-2, #423e37)",
        transition: "background 0.15s",
      }}
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}

function PillarBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--color-ink-2, #423e37)",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{count}</span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--color-line, #e5e2da)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}
