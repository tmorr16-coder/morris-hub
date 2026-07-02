import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import ChallengesClient from "./ChallengesClient";

export default async function ChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Circles I belong to (whose family-scoped challenges I should see), plus my own
  const { data: circleRows } = await db.schema("hub").from("family_members")
    .select("user_id").eq("member_user_id", user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleOwnerIds = [user.id, ...((circleRows ?? []) as any[]).map((r) => r.user_id as string)];

  const [{ data: platformChallenges }, { data: familyChallenges }, { data: joined }, { data: userPlans }] = await Promise.all([
    db.schema("bible").from("challenges")
      .select("*, plan:reading_plans(title, duration_days), participants:challenge_participants(count)")
      .eq("is_active", true).eq("visibility", "platform").order("created_at", { ascending: false }),
    db.schema("bible").from("challenges")
      .select("*, plan:reading_plans(title, duration_days), participants:challenge_participants(count)")
      .eq("is_active", true).eq("visibility", "family").in("circle_owner_id", circleOwnerIds)
      .order("created_at", { ascending: false }),
    db.schema("bible").from("challenge_participants").select("challenge_id").eq("user_id", user.id),
    db.schema("bible").from("user_plans").select("plan_id, plan:reading_plans(id, title, duration_days)").eq("user_id", user.id),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const challenges = [...(platformChallenges ?? []), ...(familyChallenges ?? [])] as any[];
  challenges.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const menuUser = { email: user.email, name: user.user_metadata?.full_name ?? user.email, avatarUrl: user.user_metadata?.avatar_url ?? null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joinedIds: string[] = ((joined ?? []) as any[]).map((j) => String(j.challenge_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eligiblePlans = ((userPlans ?? []) as any[])
    .filter((up) => up.plan)
    .map((up) => ({ id: up.plan.id as string, title: up.plan.title as string, duration_days: up.plan.duration_days as number }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>
      <ChallengesClient
        challenges={challenges}
        joinedIds={joinedIds}
        userId={user.id}
        eligiblePlans={eligiblePlans}
      />
    </div>
  );
}
