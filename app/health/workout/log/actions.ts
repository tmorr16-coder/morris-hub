"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function quickLogWorkout(data: {
  type: string;
  durationMin: number;
  notes: string | null;
  date?: string | null;         // YYYY-MM-DD; defaults to today if omitted
  distanceMiles?: number | null;
  effort?: string | null;
}): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const date = data.date ?? new Date().toLocaleDateString("sv");

  const { error } = await db.from("workout_sessions").insert({
    user_id: userId,
    date,
    type: data.type,
    duration_min: data.durationMin,
    notes: data.notes,
    ...(data.distanceMiles != null ? { distance_miles: data.distanceMiles } : {}),
    ...(data.effort ? { effort: data.effort } : {}),
  });

  if (error) return { error: error.message };

  revalidatePath("/health/train");
  revalidatePath("/health");
  return {};
}

export async function deleteWorkoutSession(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath("/health/train");
  revalidatePath("/health");
  return {};
}
