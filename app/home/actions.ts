"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Recurrence, Category, SourceApp } from "@/lib/reminders";

export type Priority = "low" | "medium" | "high";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  notes: string | null;
  due_date: string | null;
  priority: Priority | null;
  created_at: string;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function addTodo(data: {
  title: string;
  priority?: Priority | null;
  due_date?: string | null;
}): Promise<{ error?: string; todo?: Todo }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };
  if (!data.title.trim()) return { error: "Title required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: row, error } = await service
    .schema("hub")
    .from("todos")
    .insert({
      user_id: userId,
      title: data.title.trim(),
      priority: data.priority ?? null,
      due_date: data.due_date ?? null,
    })
    .select("id, title, completed, notes, due_date, priority, created_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/home");
  return { todo: row as Todo };
}

export async function toggleTodo(id: string, completed: boolean): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("todos")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function updateTodo(
  id: string,
  data: { priority?: Priority | null; due_date?: string | null; title?: string }
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("todos")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function deleteTodo(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

// ── Preferences ─────────────────────────────────────────────────────────

export async function savePreferences(data: {
  location_name?: string;
  latitude?: number;
  longitude?: number;
  stock_tickers?: string[];
  news_topics?: string[];
  visible_widgets?: string[];
  reminder_categories?: string[];
}): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("preferences")
    .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });

  if (error) return { error: error.message };
  revalidatePath("/home");
  revalidatePath("/home/settings");
  return {};
}

// ── Reminders ───────────────────────────────────────────────────────────

export async function addReminder(data: {
  title: string;
  notes?: string | null;
  due_at: string;                      // ISO timestamp
  recurrence?: Recurrence;
  category?: Category;
  source_app?: SourceApp;
}): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };
  if (!data.title.trim()) return { error: "Title required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service.schema("hub").from("reminders").insert({
    user_id: userId,
    title: data.title.trim(),
    notes: data.notes ?? null,
    due_at: data.due_at,
    recurrence: data.recurrence ?? "once",
    category: data.category ?? "general",
    source_app: data.source_app ?? "hub",
  });

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function completeReminder(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("reminders")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function snoozeReminder(id: string, until: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("reminders")
    .update({ due_at: until, snooze_until: until })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function deleteReminder(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

/**
 * Resolve a US ZIP code to lat/lon via api.zippopotam.us (free, no key).
 */
export async function lookupZip(zip: string): Promise<{
  error?: string;
  location?: { name: string; latitude: number; longitude: number };
}> {
  const cleaned = zip.trim();
  if (!/^\d{5}$/.test(cleaned)) return { error: "Enter a 5-digit US ZIP code" };

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${cleaned}`);
    if (!res.ok) return { error: "ZIP code not found" };
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return { error: "ZIP code not found" };
    return {
      location: {
        name: `${place["place name"]}, ${place["state abbreviation"]}`,
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude),
      },
    };
  } catch {
    return { error: "Lookup failed" };
  }
}
