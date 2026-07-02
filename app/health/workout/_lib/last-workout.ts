import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export interface LastWorkout {
  label: string;
  planEncoded: string;
  scheduledDate: string;
}

/**
 * Returns the most recently scheduled workout (by scheduled_date) for this
 * user that has a stored plan_encoded, or null if there isn't one.
 *
 * Read-only — does not mutate scheduled_workouts. Used to power the
 * "Repeat last workout" shortcut on the builder's select screen.
 */
export async function getLastWorkout(userId: string): Promise<LastWorkout | null> {
  const db: AnyClient = createAdminClient();

  const { data, error } = await db
    .from("scheduled_workouts")
    .select("label, plan_encoded, scheduled_date")
    .eq("user_id", userId)
    .not("plan_encoded", "is", null)
    .order("scheduled_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.plan_encoded) return null;

  return {
    label: data.label,
    planEncoded: data.plan_encoded,
    scheduledDate: data.scheduled_date,
  };
}
