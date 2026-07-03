export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Icons } from "@/components/ios";
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
      (new Date(goal.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const targetLabel = goal.target_date
    ? new Date(goal.target_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const remainingLabel =
    daysUntil !== null
      ? daysUntil < 0
        ? `${Math.abs(daysUntil)} days overdue`
        : daysUntil === 0
        ? "Due today"
        : `${daysUntil} days remaining`
      : null;
  const subtitle = targetLabel
    ? [`Target ${targetLabel}`, remainingLabel].filter(Boolean).join(" · ")
    : undefined;

  return (
    <div className="ios-scroll">
      <Link
        href="/career/goals"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--ios-tint)",
          padding: "6px 16px 0",
          fontWeight: 500,
        }}
        className="ios-subhead"
      >
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Goals
      </Link>

      <LargeTitle title={goal.title} subtitle={subtitle} />

      {/* Tabs / detail client component */}
      <GoalDetailClient
        goal={goal}
        milestones={milestones}
        notes={notes}
        experiences={experiences}
        learningItems={learningItems}
        daysUntil={daysUntil}
      />
    </div>
  );
}
