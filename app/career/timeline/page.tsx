/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import TimelineClient from "./_components/TimelineClient";

export default async function CareerTimelinePage() {
  const user = await getCurrentUser();
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
      .select("*")
      .eq("user_id", user.id),
  ]);

  const goals = goalsRes.data ?? [];
  const milestones = milestonesRes.data ?? [];

  // Attach milestones to their goals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goalsWithMilestones = goals.map((g: any) => ({
    ...g,
    milestones: milestones.filter((m: any) => m.goal_id === g.id),
  }));

  return (
    <div className="ios-scroll">      <LargeTitle title="Timeline" subtitle="Goals & milestones over time" />
      <TimelineClient goals={goalsWithMilestones} />
    </div>
  );
}
