"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/supabase/auth-utils";
import { logEvent } from "@/lib/usage";

export type AppKey = "hub" | "health" | "finance" | "student-success" | "investments" | "bible" | "career";

async function sendUserEmail(to: string, subject: string, html: string, userId?: string) {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";
    await resend.emails.send({ from, to, subject, html });
    logEvent({ eventType: "email", userId: userId ?? null, metadata: { subject, to } });
  } catch { /* non-fatal */ }
}

export async function inviteUser(
  email: string,
  role: "standard" | "admin",
  appAccess: AppKey[] = ["hub"]
): Promise<{ error?: string }> {
  const { db, id: currentUserId } = await requireAdmin();

  const { error: inviteError } = await db.auth.admin.inviteUserByEmail(email.toLowerCase().trim(), {
    data: { intended_role: role, intended_app_access: appAccess },
  });
  if (inviteError) return { error: inviteError.message };

  await db.from("invitations").insert({
    email: email.toLowerCase().trim(),
    role,
    invited_by: currentUserId,
  });

  return {};
}

export async function cancelInvitation(id: string): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { error } = await db.from("invitations").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function updateUserRole(
  userId: string,
  role: "standard" | "admin"
): Promise<{ error?: string }> {
  const { db, id: currentUserId } = await requireAdmin();
  if (userId === currentUserId && role !== "admin") {
    return { error: "You cannot remove your own admin role." };
  }
  const { error } = await db.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Update per-app access for a user. Pass the full new app_access array.
 */
export async function updateAppAccess(
  userId: string,
  appAccess: AppKey[]
): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { error } = await db
    .from("profiles")
    .update({ app_access: appAccess })
    .eq("id", userId);
  if (error) return { error: error.message };
  return {};
}

export async function removeUser(userId: string): Promise<{ error?: string }> {
  const { db, id: currentUserId } = await requireAdmin();
  if (userId === currentUserId) return { error: "You cannot remove your own account here." };
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return {};
}

export async function updateIntegrationRequestStatus(
  id: string,
  status: "reviewed" | "planned" | "declined"
): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { error } = await db
    .from("integration_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function approveUser(userId: string, appAccess: AppKey[] = ["hub"]): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { error } = await db
    .from("profiles")
    .update({ status: "approved", app_access: appAccess })
    .eq("id", userId);
  if (error) return { error: error.message };

  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://morrisai.family";
  const appsList = appAccess.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(", ");
  await sendUserEmail(
    userEmail ?? "",
    "Your morrisai.family account has been approved",
    `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
       <h2 style="margin: 0 0 10px; font-size: 20px;">You're approved!</h2>
       <p style="margin: 0 0 16px; color: #666; font-size: 14px; line-height: 1.6;">
         You now have access to: <strong>${appsList}</strong>.
       </p>
       <a href="${siteUrl}" style="display: inline-block; padding: 10px 18px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Sign in →</a>
     </div>`,
    userId
  );
  return {};
}

export async function rejectUser(userId: string): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;
  await sendUserEmail(
    userEmail ?? "",
    "morrisai.family — access request",
    `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
       <h2 style="margin: 0 0 10px; font-size: 20px;">Access not approved</h2>
       <p style="margin: 0 0 16px; color: #666; font-size: 14px; line-height: 1.6;">
         Your request to access morrisai.family was not approved.
       </p>
     </div>`
  );
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return {};
}

export async function updateTicketStatus(
  id: string,
  status: "in_progress" | "resolved" | "closed"
): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { error } = await db
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}
