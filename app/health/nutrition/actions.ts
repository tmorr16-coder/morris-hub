"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export async function addMeal(data: {
  date: string;
  meal_type: MealType;
  name: string;
  calories_est: number | null;
  notes: string | null;
  is_favorite?: boolean;
}): Promise<{ error?: string; id?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { data: row, error } = await db
    .from("meals")
    .insert({ user_id: userId, ...data })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/health/nutrition");
  revalidatePath("/health");
  return { id: row.id };
}

export async function deleteMeal(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("meals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/health/nutrition");
  revalidatePath("/health");
  return {};
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("meals")
    .update({ is_favorite: isFavorite })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/health/nutrition");
  return {};
}

export async function logFavoriteMeal(data: {
  date: string;
  meal_type: MealType;
  name: string;
  calories_est: number | null;
}): Promise<{ error?: string }> {
  return addMeal({ ...data, notes: null, is_favorite: false });
}
