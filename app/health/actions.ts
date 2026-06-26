"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";

export async function syncAll(): Promise<{ message: string }> {
  const userId = await getCurrentUserId();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  const headers: Record<string, string> = cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {};

  const results: string[] = [];

  await Promise.allSettled([
    fetch(`${siteUrl}/api/health/oura/sync?userId=${encodeURIComponent(userId)}`, { headers })
      .then((r) => r.json())
      .then((d: { metrics_inserted?: number }) => {
        if (typeof d.metrics_inserted === "number") results.push(`Oura +${d.metrics_inserted}`);
      })
      .catch(() => {}),
    fetch(`${siteUrl}/api/health/withings/sync?userId=${encodeURIComponent(userId)}`, { headers })
      .then((r) => r.json())
      .then((d: { measurements_inserted?: number }) => {
        if (typeof d.measurements_inserted === "number") results.push(`Withings +${d.measurements_inserted}`);
      })
      .catch(() => {}),
  ]);

  revalidatePath("/health");
  return { message: results.length ? results.join(" · ") : "Up to date" };
}

export async function logDose(data: {
  date: string;
  dose_mg: number;
  injection_site: string;
  notes: string;
}): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const userId = await getCurrentUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("doses").insert({
    user_id: userId,
    date: data.date,
    dose_mg: data.dose_mg,
    injection_site: data.injection_site || null,
    notes: data.notes || null,
  });

  if (error) return { error: (error as { message: string }).message };

  revalidatePath("/health");
  revalidatePath("/health/zepbound");

  return {};
}
