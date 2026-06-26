"use server";

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/usage";

export async function saveOuraToken(token: string): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { error } = await db.from("oura_tokens").upsert(
    { user_id: userId, access_token: token.trim(), updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/health/settings/integrations");
  return {};
}

export async function disconnectOura(): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const { error } = await db.from("oura_tokens").delete().eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/health/settings/integrations");
  return {};
}

export async function disconnectWithings(): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("withings_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath("/health/settings/integrations");
  return {};
}

export async function triggerSync(): Promise<{ inserted?: number; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const cronSecret = process.env.CRON_SECRET;
  const userId = await getCurrentUserId();

  const headers: Record<string, string> = {};
  if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;

  try {
    const res = await fetch(`${siteUrl}/api/health/withings/sync?userId=${encodeURIComponent(userId)}`, { headers });
    const json = (await res.json()) as { measurements_inserted?: number; error?: string };
    if (!res.ok) return { error: json.error ?? "Sync failed" };
    const inserted = json.measurements_inserted ?? 0;
    logEvent({ eventType: "withings_sync", userId, metadata: { inserted } });
    return { inserted };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function triggerOuraSync(): Promise<{ inserted?: number; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const cronSecret = process.env.CRON_SECRET;
  const userId = await getCurrentUserId();

  const headers: Record<string, string> = {};
  if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;

  try {
    const res = await fetch(`${siteUrl}/api/health/oura/sync?userId=${encodeURIComponent(userId)}`, { headers });
    const json = (await res.json()) as { metrics_inserted?: number; error?: string };
    if (!res.ok) return { error: json.error ?? "Sync failed" };
    const inserted = json.metrics_inserted ?? 0;
    logEvent({ eventType: "oura_sync", userId, metadata: { inserted } });
    return { inserted };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function requestIntegration(data: {
  integration: string;
  description: string;
}): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  // Get requesting user's info
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email ?? "";
  const userName = authUser?.user?.user_metadata?.full_name ?? authUser?.user?.user_metadata?.name ?? userEmail;

  // Save request to DB
  const { error: dbError } = await db.from("integration_requests").insert({
    user_id: userId,
    user_email: userEmail,
    user_name: userName,
    integration: data.integration.trim(),
    description: data.description.trim() || null,
  });
  if (dbError) return { error: dbError.message };
  logEvent({ eventType: "integration_request", userId, metadata: { integration: data.integration } });

  // Email all admins
  if (process.env.RESEND_API_KEY) {
    try {
      const { data: adminProfiles } = await db
        .from("profiles")
        .select("email")
        .eq("role", "admin");

      type ProfileRow = { email: string | null };
      const adminEmails: string[] = ((adminProfiles as ProfileRow[]) ?? [])
        .map((p) => p.email)
        .filter((e): e is string => !!e);

      if (adminEmails.length > 0) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

        await resend.emails.send({
          from: fromEmail,
          to: adminEmails,
          subject: `Integration request: ${data.integration}`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
              <h2 style="margin: 0 0 6px; font-size: 20px;">New integration request</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 14px;">Someone wants a new integration added to the health dashboard.</p>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 10px 14px; background: #f5f5f3; border-radius: 6px 6px 0 0; font-weight: 600; width: 120px;">Integration</td>
                  <td style="padding: 10px 14px; background: #f5f5f3; border-radius: 6px 6px 0 0;">${data.integration}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; background: #fafaf8; font-weight: 600;">Requested by</td>
                  <td style="padding: 10px 14px; background: #fafaf8;">${userName} &lt;${userEmail}&gt;</td>
                </tr>
                ${data.description ? `
                <tr>
                  <td style="padding: 10px 14px; background: #f5f5f3; font-weight: 600; border-radius: 0 0 6px 6px;">Notes</td>
                  <td style="padding: 10px 14px; background: #f5f5f3; border-radius: 0 0 6px 6px;">${data.description}</td>
                </tr>` : ""}
              </table>

              <a href="https://morrisai.family/home/admin" style="display: inline-block; padding: 10px 18px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">View in admin panel →</a>
            </div>
          `,
        });
      }
    } catch { /* email failure is non-fatal */ }
  }

  return {};
}
