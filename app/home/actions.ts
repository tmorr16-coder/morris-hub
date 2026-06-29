"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
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

export async function addTodo(data: {
  title: string;
  priority?: Priority | null;
  due_date?: string | null;
}): Promise<{ error?: string; todo?: Todo }> {
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
  employer_ticker?: string | null;
  news_topics?: string[];
  city_names?: string[];
  sports_enabled_teams?: string[];
  investment_categories?: string[];
  visible_widgets?: string[];
  reminder_categories?: string[];
  app_access?: string[];
  news_sources?: object[];
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
}): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
 * Mark a student_support.course_reminder as completed from the hub widget.
 * This is separate from hub.reminders because it lives in a different schema.
 */
export async function completeCourseReminder(id: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("student_support")
    .from("course_reminders")
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function updateReminder(
  id: string,
  updates: { next_steps?: string[] }
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("reminders")
    .update(updates)
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

// ── Investment Ideas ────────────────────────────────────────────────

export interface InvestmentIdeaInsert {
  category: string;
  title: string;
  rationale?: string | null;
  risk_level?: string | null;
  time_horizon?: string | null;
  capital_required?: string | null;
  expected_returns?: string | null;
  related_assets?: string[] | null;
  action_items?: string[] | null;
  is_ai_generated?: boolean;
  source?: string;
  rating?: number | null;
  status?: string;
  is_favorite?: boolean;
  user_notes?: string | null;
}

export async function addInvestmentIdea(data: InvestmentIdeaInsert): Promise<{
  error?: string;
  idea?: InvestmentIdeaInsert & { id: string };
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };
  if (!data.title?.trim()) return { error: "Title required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: row, error } = await service
    .schema("hub")
    .from("investment_ideas")
    .insert({
      user_id: userId,
      category: data.category,
      title: data.title.trim(),
      rationale: data.rationale ?? null,
      risk_level: data.risk_level ?? null,
      time_horizon: data.time_horizon ?? null,
      capital_required: data.capital_required ?? null,
      expected_returns: data.expected_returns ?? null,
      related_assets: data.related_assets ?? null,
      action_items: data.action_items ?? null,
      is_ai_generated: data.is_ai_generated ?? false,
      source: data.source ?? "user",
      rating: data.rating ?? null,
      status: data.status ?? "new",
      is_favorite: data.is_favorite ?? false,
      user_notes: data.user_notes ?? null,
    })
    .select("*")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/investments");
  return { idea: row };
}

export async function updateInvestmentIdea(
  id: string,
  data: Partial<InvestmentIdeaInsert>
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("investment_ideas")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/investments");
  return {};
}

export async function deleteInvestmentIdea(id: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("investment_ideas")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/investments");
  return {};
}

export async function updateIdeaStatus(id: string, status: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("investment_ideas")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/investments");
  return {};
}

export async function rateIdea(id: string, rating: number): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };
  if (rating < 0 || rating > 5) return { error: "Rating must be between 0 and 5" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("investment_ideas")
    .update({ rating })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/investments");
  return {};
}

export async function toggleFavorite(id: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Get current favorite status
  const { data: idea, error: fetchError } = await service
    .schema("hub")
    .from("investment_ideas")
    .select("is_favorite")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError) return { error: fetchError.message };

  const { error: updateError } = await service
    .schema("hub")
    .from("investment_ideas")
    .update({ is_favorite: !idea.is_favorite })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) return { error: updateError.message };
  revalidatePath("/investments");
  return {};
}

export async function updateIdeaNotes(id: string, notes: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("investment_ideas")
    .update({ user_notes: notes || null })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/investments");
  return {};
}
