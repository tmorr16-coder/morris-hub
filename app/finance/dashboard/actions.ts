"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncItem } from "@/lib/finance/sync";

export async function syncAll(): Promise<{ ok: boolean; synced?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const service = createServiceClient();
  const { data: items, error } = await service
    .schema("finance")
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) return { ok: false, error: error.message };
  if (!items || items.length === 0) return { ok: false, error: "no items to sync" };

  let total = 0;
  for (const item of items) {
    const r = await syncItem(item.id);
    if (!r.error) total += r.added + r.modified;
  }

  revalidatePath("/finance/dashboard");
  return { ok: true, synced: total };
}
