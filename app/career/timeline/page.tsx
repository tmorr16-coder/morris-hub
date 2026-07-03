/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Icons } from "@/components/ios";
import TimelineClient from "./_components/TimelineClient";

export default async function CareerTimelinePage() {
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
    <div className="ios-scroll">
      <Link href="/career" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Career
      </Link>
      <LargeTitle title="Timeline" subtitle="Goals & milestones over time" />
      <TimelineClient goals={goalsWithMilestones} />
    </div>
  );
}
