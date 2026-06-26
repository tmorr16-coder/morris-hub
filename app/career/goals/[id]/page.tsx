export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import GoalDetailClient from "./_components/GoalDetailClient";

interface GoalPageProps {
  params: Promise<{ id: string }>;
}

export default async function GoalDetailPage({ params }: GoalPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [goalRes, milestonesRes, notesRes, experiencesRes, learningRes] = await Promise.all([
    db
      .schema("career")
      .from("career_goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    db
      .schema("career")
      .from("career_milestones")
      .select("*")
      .eq("goal_id", id)
      .order("target_date", { ascending: true }),
    db
      .schema("career")
      .from("career_goal_notes")
      .select("*")
      .eq("goal_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .schema("career")
      .from("career_goal_experiences")
      .select("*, career_experiences(*)")
      .eq("goal_id", id),
    db
      .schema("career")
      .from("career_goal_learning")
      .select("*, career_learning(*)")
      .eq("goal_id", id),
  ]);

  if (goalRes.error || !goalRes.data) notFound();

  const goal = goalRes.data;
  const milestones = milestonesRes.data ?? [];
  const notes = notesRes.data ?? [];
  const experiences = experiencesRes.data ?? [];
  const learningItems = learningRes.data ?? [];

  // Days until target
  let daysUntil: number | null = null;
  if (goal.target_date) {
    daysUntil = Math.ceil(
      (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }

  return (
    <div data-section="career">
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* Back */}
        <Link
          href="/career/goals"
          style={{
            fontSize: 12,
            color: "var(--color-ink-3, #8a8278)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 24,
          }}
        >
          ← All Goals
        </Link>

        {/* Goal header */}
        <div
          style={{
            borderLeft: `5px solid ${goal.color_tag ?? "var(--color-accent)"}`,
            paddingLeft: 20,
            marginBottom: 36,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <CategoryBadge category={goal.category} />
            <HorizonBadge horizon={goal.horizon} />
            <StatusBadge status={goal.status} />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 38,
              fontWeight: 400,
              margin: "0 0 10px",
              color: "var(--color-ink)",
              lineHeight: 1.15,
            }}
          >
            {goal.title}
          </h1>
          {goal.target_date && (
            <div
              style={{
                fontSize: 13,
                color:
                  daysUntil !== null && daysUntil < 0
                    ? "#9a3b2a"
                    : daysUntil !== null && daysUntil < 30
                    ? "#b88a2e"
                    : "var(--color-ink-3, #8a8278)",
                fontWeight: 500,
              }}
            >
              Target:{" "}
              {new Date(goal.target_date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {daysUntil !== null && (
                <span style={{ marginLeft: 8 }}>
                  ({daysUntil < 0
                    ? `${Math.abs(daysUntil)} days overdue`
                    : daysUntil === 0
                    ? "Due today"
                    : `${daysUntil} days remaining`})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabs / detail client component */}
        <GoalDetailClient
          goal={goal}
          milestones={milestones}
          notes={notes}
          experiences={experiences}
          learningItems={learningItems}
          daysUntil={daysUntil}
        />
      </main>
    </div>
  );
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        background: "var(--color-accent-soft, #dde5ee)",
        color: "var(--color-accent)",
      }}
    >
      {category}
    </span>
  );
}

function HorizonBadge({ horizon }: { horizon: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    "short-term": { bg: "#e6f0e0", text: "#3a6b3a" },
    "medium-term": { bg: "#f5eede", text: "#7a5a2a" },
    "long-term": { bg: "#e0e6f0", text: "#3a4a6b" },
  };
  const c = map[horizon] ?? { bg: "#f0ede6", text: "#8a8278" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "capitalize",
        background: c.bg,
        color: c.text,
      }}
    >
      {horizon}
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
        padding: "3px 10px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "capitalize",
        background: c.bg,
        color: c.text,
      }}
    >
      {status}
    </span>
  );
}
