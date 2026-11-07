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
    .in("status", ["active", "error"]);

  if (error) return { ok: false, error: error.message };
  if (!items || items.length === 0) return { ok: false, error: "no items to sync" };

  let total = 0;
  const failures: string[] = [];
  for (const item of items) {
    const r = await syncItem(item.id);
    total += r.added + r.modified;
    if (r.error) failures.push(r.error);
  }

  revalidatePath("/finance/dashboard");
  return failures.length ? { ok: false, synced: total, error: `${failures.length} connection(s) could not fully sync: ${failures.join(" · ")}` } : { ok: true, synced: total };
}
