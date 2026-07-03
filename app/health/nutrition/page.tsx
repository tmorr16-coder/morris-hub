export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import NutritionClient, { type Meal } from "./_components/NutritionClient";

export default async function NutritionPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const today = new Date().toLocaleDateString("sv");

  const [{ data: todayMeals }, { data: favMeals }] = await Promise.all([
    db.from("meals")
      .select("id, meal_type, name, calories_est, notes, is_favorite")
      .eq("user_id", userId)
      .eq("date", today)
      .order("created_at", { ascending: true }),
    db.from("meals")
      .select("id, meal_type, name, calories_est, notes, is_favorite")
      .eq("user_id", userId)
      .eq("is_favorite", true)
      .order("name", { ascending: true })
      .limit(20),
  ]);

  const meals: Meal[] = (todayMeals as Meal[] | null) ?? [];
  const favorites: Meal[] = (favMeals as Meal[] | null) ?? [];

  return (
    <div className="ios-scroll">
      <NutritionClient date={today} meals={meals} favorites={favorites} />
    </div>
  );
}
