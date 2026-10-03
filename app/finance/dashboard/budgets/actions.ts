"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PATHS = ["/finance/dashboard/budgets", "/finance/dashboard/insights", "/home"];

export async function saveBudget(input: { id?: string; category: string; monthlyLimit: number; warnAtPct: number; notifySms: boolean }): Promise<{ error?: string; id?: string }> {
  const { user } = await requireFinanceAccess();
  const category = String(input.category ?? "").trim().toUpperCase();
  const limit = Number(input.monthlyLimit);
  const warn = Math.round(Number(input.warnAtPct));
  if (!category || !/^[A-Z_*]+$/.test(category)) return { error: "Pick a category." };
  if (!Number.isFinite(limit) || limit <= 0) return { error: "The limit has to be more than zero." };
  if (!Number.isFinite(warn) || warn < 1 || warn > 100) return { error: "Warn between 1% and 100%." };

  const svc = createServiceClient() as any;
  const row = { user_id: user.id, category, monthly_limit: limit, warn_at_pct: warn, notify_sms: !!input.notifySms, updated_at: new Date().toISOString() };
  const { data, error } = await svc.schema("finance").from("budgets")
    .upsert(row, { onConflict: "user_id,category" })
    .select("id").maybeSingle();
  if (error) return { error: error.message };
  for (const p of PATHS) revalidatePath(p);
  return { id: (data as { id: string } | null)?.id };
}

export async function deleteBudget(id: string): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  const svc = createServiceClient() as any;
  const { error } = await svc.schema("finance").from("budgets").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  for (const p of PATHS) revalidatePath(p);
  return {};
}
