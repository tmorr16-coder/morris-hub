export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import { circleContext } from "@/lib/family/circle";
import MealPlan from "../_components/MealPlan";

export default async function FamilyMealsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { circleIds } = await circleContext(service, user.id);
  // Upcoming meals from today onward.
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: meals } = await service.schema("hub").from("meal_plan")
    .select("id, date, meal_type, name, notes, created_by, created_at")
    .in("circle_owner_id", circleIds)
    .gte("date", todayStr)
    .order("date", { ascending: true });

  return (
    <IOSScreen>
      <LargeTitle title="Meal plan" subtitle="What's cooking this week" />
      <div style={{ padding: "0 16px" }}>
        <MealPlan initialMeals={meals ?? []} userId={user.id} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="family" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
