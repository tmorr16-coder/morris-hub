export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import { circleContext } from "@/lib/family/circle";
import HouseholdGoals from "../_components/HouseholdGoals";

export default async function FamilyGoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { circleIds, nameMap, members } = await circleContext(service, user.id);
  const { data: goals } = await service.schema("hub").from("household_goals")
    .select("*")
    .in("circle_owner_id", circleIds)
    .order("created_at", { ascending: false });

  return (
    <IOSScreen>
      <LargeTitle title="Household goals" subtitle="Shared goals for your family" />
      <div style={{ padding: "0 16px" }}>
        <HouseholdGoals initialGoals={goals ?? []} userId={user.id} nameMap={nameMap} members={members} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="family" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
