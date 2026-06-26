"use server";

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { logEvent } from "@/lib/usage";

export async function saveProfileGoals(data: {
  targetWeightLbs: number | null;
  calorieGoal: number | null;
}): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const meta: Record<string, unknown> = {};
  if (data.targetWeightLbs !== null) meta.target_weight_lbs = data.targetWeightLbs;
  if (data.calorieGoal !== null) meta.calorie_goal = data.calorieGoal;

  const { error } = await db.auth.admin.updateUserById(userId, { user_metadata: meta });
  if (error) return { error: error.message };
  return {};
}

export async function submitSupportTicket(data: {
  type: string;
  subject: string;
  description: string;
}): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email ?? "";
  const userName = authUser?.user?.user_metadata?.full_name ?? authUser?.user?.user_metadata?.name ?? userEmail;

  const { error: dbError } = await db.from("support_tickets").insert({
    user_id: userId,
    user_email: userEmail,
    user_name: userName,
    type: data.type,
    subject: data.subject.trim(),
    description: data.description.trim(),
  });
  if (dbError) return { error: dbError.message };
  logEvent({ eventType: "support_ticket", userId, metadata: { type: data.type, subject: data.subject } });

  if (process.env.RESEND_API_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: adminProfiles } = await (db as any).from("profiles").select("email").eq("role", "admin");
      type Row = { email: string | null };
      const adminEmails: string[] = ((adminProfiles as Row[]) ?? []).map((r) => r.email).filter((e): e is string => !!e);
      if (adminEmails.length) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";
        const typeLabel: Record<string, string> = { bug: "Bug report", feature: "Feature request", question: "Question", other: "Other" };
        await resend.emails.send({
          from,
          to: adminEmails,
          subject: `Support ticket: ${data.subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
              <h2 style="margin: 0 0 6px; font-size: 20px;">New support ticket</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 14px;">${userName} &lt;${userEmail}&gt; submitted a ${typeLabel[data.type] ?? data.type.toLowerCase()}.</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
                <tr><td style="padding: 10px 14px; background: #f5f5f3; border-radius: 6px 6px 0 0; font-weight: 600; width: 100px;">Subject</td><td style="padding: 10px 14px; background: #f5f5f3; border-radius: 6px 6px 0 0;">${data.subject}</td></tr>
                <tr><td style="padding: 10px 14px; background: #fafaf8; font-weight: 600;">Type</td><td style="padding: 10px 14px; background: #fafaf8;">${typeLabel[data.type] ?? data.type}</td></tr>
                <tr><td style="padding: 10px 14px; background: #f5f5f3; font-weight: 600; border-radius: 0 0 6px 6px; vertical-align: top;">Details</td><td style="padding: 10px 14px; background: #f5f5f3; border-radius: 0 0 6px 6px; white-space: pre-wrap;">${data.description}</td></tr>
              </table>
              <a href="https://morrisai.family/home/admin" style="display: inline-block; padding: 10px 18px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">View in admin panel →</a>
            </div>
          `,
        });
      }
    } catch { /* non-fatal */ }
  }

  return {};
}

export async function deleteMyAccount(): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  // Deleting from auth.users cascades to profiles and all user data tables
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return {};
}
