"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function addMedication(data: {
  name: string;
  dose: string;
  schedule: string;
}): Promise<{ id?: string; error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { data: row, error } = await db
    .from("medications")
    .insert({ user_id: userId, name: data.name, dose: data.dose, schedule: data.schedule })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/health/medications");
  return { id: row.id };
}

export async function updateMedication(
  id: string,
  data: { name: string; dose: string; schedule: string }
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("medications")
    .update({ name: data.name, dose: data.dose, schedule: data.schedule })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/health/medications");
  return {};
}

export async function removeMedication(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("medications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/health/medications");
  return {};
}
