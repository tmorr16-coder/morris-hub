"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";
import { EXERCISE_LIBRARY } from "./exercise-library";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

interface SessionExercise {
  name: string;
  muscles: string[];
}

export async function createWorkoutSession(
  customExercises?: SessionExercise[]
): Promise<{
  sessionId: string;
  exerciseIds: string[];
  error?: string;
}> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const exList: SessionExercise[] = customExercises
    ?? EXERCISE_LIBRARY.map((ex) => ({ name: ex.name, muscles: ex.muscles }));

  const type = customExercises ? "Custom Workout" : "Lower Body Power";

  const { data: session, error: sessionErr } = await db
    .from("workout_sessions")
    .insert({ user_id: userId, date: new Date().toLocaleDateString("sv"), type })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return { sessionId: "", exerciseIds: [], error: sessionErr?.message ?? "Failed to create session" };
  }

  const inserts = exList.map((ex, i) => ({
    session_id: session.id,
    user_id: userId,
    name: ex.name,
    order_index: i,
    muscles: ex.muscles,
  }));

  const { data: exercises, error: exErr } = await db
    .from("exercises")
    .insert(inserts)
    .select("id, name");

  if (exErr || !exercises) {
    return { sessionId: session.id, exerciseIds: [], error: exErr?.message ?? "Failed to create exercises" };
  }

  const exerciseIds = exList.map(
    (ex) => (exercises as { id: string; name: string }[]).find((e) => e.name === ex.name)?.id ?? ""
  );

  return { sessionId: session.id, exerciseIds };
}

export async function saveSet(data: {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number;
}): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db.from("sets").insert({
    exercise_id: data.exerciseId,
    user_id: userId,
    set_number: data.setNumber,
    reps_actual: data.reps,
    weight_actual: data.weight,
    rpe: data.rpe,
  });

  if (error) return { error: error.message };
  return {};
}

export async function updateSet(data: {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number;
}): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db.from("sets")
    .update({ reps_actual: data.reps, weight_actual: data.weight, rpe: data.rpe })
    .eq("exercise_id", data.exerciseId)
    .eq("set_number", data.setNumber)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return {};
}

export async function finishSession(
  sessionId: string,
  durationMin: number
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();

  const { error } = await db
    .from("workout_sessions")
    .update({ duration_min: durationMin })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/health");
  return {};
}

export interface CardioBlock {
  type: string;
  durationMin: number;
  distanceMiles?: number;
}

export async function deleteSession(
  sessionId: string
): Promise<{ error?: string }> {
  if (!sessionId) return {};
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  // Delete child records first, then the session itself
  const exerciseQuery = await db.from("exercises").select("id").eq("session_id", sessionId).eq("user_id", userId);
  const exerciseIds: string[] = (exerciseQuery.data ?? []).map((e: { id: string }) => e.id);
  if (exerciseIds.length) {
    await db.from("sets").delete().in("exercise_id", exerciseIds);
    await db.from("exercises").delete().in("id", exerciseIds);
  }
  const { error } = await db.from("workout_sessions").delete().eq("id", sessionId).eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/health");
  return {};
}

export async function scheduleWorkout(data: {
  label: string;
  scheduledDate: string;
  scheduledTime: string;
  planEncoded: string;
  reminderMin: number;
}): Promise<{ error?: string; id?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { data: row, error } = await db
    .from("scheduled_workouts")
    .insert({
      user_id: userId,
      label: data.label || "Workout",
      scheduled_date: data.scheduledDate,
      scheduled_time: data.scheduledTime,
      plan_encoded: data.planEncoded,
      reminder_min: data.reminderMin,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/health/train");
  return { id: row.id };
}

export async function deleteScheduledWorkout(
  id: string
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const { error } = await db
    .from("scheduled_workouts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/train");
  return {};
}

export async function saveCardioBlocks(
  blocks: CardioBlock[]
): Promise<{ error?: string }> {
  if (!blocks.length) return {};
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();
  const date = new Date().toLocaleDateString("sv");

  const rows = blocks.map((b) => ({
    user_id: userId,
    date,
    type: b.type,
    duration_min: b.durationMin,
    ...(b.distanceMiles != null ? { distance_miles: b.distanceMiles } : {}),
  }));

  const { error } = await db.from("workout_sessions").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/health");
  return {};
}
