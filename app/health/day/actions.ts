"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function updateWorkoutSession(
  id: string,
  data: {
    type?: string;
    duration_min?: number;
    effort?: string | null;
    notes?: string | null;
    distance_miles?: number | null;
  }
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("workout_sessions")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/day");
  revalidatePath("/health/train");
  revalidatePath("/health");
  return {};
}

export async function deleteWorkout(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/day");
  revalidatePath("/health/train");
  revalidatePath("/health");
  return {};
}

export async function updateMeal(
  id: string,
  data: {
    meal_type?: string;
    name?: string;
    calories_est?: number | null;
    notes?: string | null;
  }
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("meals")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/day");
  revalidatePath("/health/nutrition");
  revalidatePath("/health");
  return {};
}

export async function deleteMealEntry(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("meals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/day");
  revalidatePath("/health/nutrition");
  revalidatePath("/health");
  return {};
}

export async function updateDose(
  id: string,
  data: { dose_mg?: number; injection_site?: string; notes?: string | null }
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("doses")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/day");
  revalidatePath("/health/medications");
  return {};
}

export async function deleteDose(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("doses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/day");
  revalidatePath("/health/medications");
  return {};
}
