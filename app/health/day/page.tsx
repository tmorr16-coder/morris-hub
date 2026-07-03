export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import DayViewClient, { type DayData } from "./_components/DayViewClient";
import { LargeTitle } from "@/components/ios";

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const { date: dateParam } = await searchParams;

  const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD
  const date = dateParam ?? today;

  // Fetch workouts, meals, doses in parallel
  const [workoutsResult, mealsResult, dosesResult, medicationsResult] = await Promise.all([
    db
      .from("workout_sessions")
      .select("id, date, type, duration_min, effort, notes, distance_miles")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at", { ascending: true }),

    db
      .from("meals")
      .select("id, meal_type, name, calories_est, notes")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at", { ascending: true }),

    db
      .from("doses")
      .select("id, date, dose_mg, injection_site, notes")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at", { ascending: true })
      .maybeSingle()
      .then((r: { data: unknown; error: unknown }) => r), // doses table may not exist

    db
      .from("medications")
      .select("id, name, dose, schedule")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true }),
  ]);

  const dayData: DayData = {
    date,
    today,
    workouts: workoutsResult.data ?? [],
    meals: mealsResult.data ?? [],
    dose: dosesResult.data ?? null,
    medications: medicationsResult.data ?? [],
  };

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="ios-scroll">
      <LargeTitle title={date === today ? "Today" : "Daily log"} subtitle={dateLabel} />
      <DayViewClient data={dayData} />
    </div>
  );
}
