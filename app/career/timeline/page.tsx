export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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
    <div data-section="career">
      <main style={{ maxWidth: "100%", padding: "40px 28px 80px" }}>
        {/* Header */}
        <div style={{ maxWidth: 1280, margin: "0 auto 36px" }}>
          <Link
            href="/career"
            style={{
              fontSize: 12,
              color: "var(--color-ink-3, #8a8278)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 16,
            }}
          >
            ← Career
          </Link>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 40,
              fontWeight: 400,
              margin: 0,
              color: "var(--color-ink)",
            }}
          >
            Career Timeline
          </h1>
        </div>

        <TimelineClient goals={goalsWithMilestones} />
      </main>
    </div>
  );
}
