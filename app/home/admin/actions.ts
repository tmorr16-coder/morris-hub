"use server";

import { Resend } from "resend";
import { requireAdmin } from "@/lib/supabase/auth-utils";
import { logEvent } from "@/lib/usage";

export type AppKey = "hub" | "health" | "finance" | "student-success" | "children" | "investments" | "bible" | "career" | "travel";

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
 * Persist a user's module access to the authoritative store used for gating.
 *
 * There are two app_access columns in play:
 *  - hub.preferences.app_access — read by getPreferences() and thus by the More
 *    menu, Me dashboard, and the Career / Investments / Courses / Finance gates.
 *    This is the store the app actually reads, so it MUST be written.
 *  - public.profiles.app_access — read by the Finance and Health server layouts
 *    (lib/finance/access.ts, app/health/layout.tsx) and shown in this console.
 *
 * We write BOTH so the two stores stay in sync and every gate agrees.
 */
async function persistAppAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  appAccess: AppKey[]
): Promise<{ error?: string }> {
  // Authoritative store consumed by getPreferences(). Upsert so users without a
  // preferences row yet still get one.
  const { error: prefErr } = await db
    .schema("hub")
    .from("preferences")
    .upsert({ user_id: userId, app_access: appAccess }, { onConflict: "user_id" });
  if (prefErr) return { error: prefErr.message };

  // Mirror onto profiles for the Finance/Health layouts and this console's list.
  const { error: profErr } = await db
    .from("profiles")
    .update({ app_access: appAccess })
    .eq("id", userId);
  if (profErr) return { error: profErr.message };

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
  return persistAppAccess(db, userId, appAccess);
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

  // Keep the authoritative preferences store in sync with the granted modules.
  const syncErr = await persistAppAccess(db, userId, appAccess);
  if (syncErr.error) return { error: syncErr.error };

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

// ── Access requests (public waitlist) ───────────────────────────────────────
// The public "Request access" form on the landing page inserts into
// hub.waitlist (see app/api/waitlist/route.ts). These helpers let an admin turn
// a waitlist entry into a real invite, or dismiss it.

/**
 * Approve a waitlist entry: send the applicant an invite with the chosen role
 * and module access, then remove them from the waitlist. Reuses inviteUser so
 * the invite path is identical to the manual "Invite user" flow.
 */
export async function approveAccessRequest(
  id: string,
  email: string,
  role: "standard" | "admin" = "standard",
  appAccess: AppKey[] = ["hub"]
): Promise<{ error?: string }> {
  const { db } = await requireAdmin();

  const result = await inviteUser(email, role, appAccess);
  if (result.error) return { error: result.error };

  const { error } = await db.schema("hub").from("waitlist").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

/** Dismiss (delete) a waitlist entry without inviting the applicant. */
export async function dismissAccessRequest(id: string): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { error } = await db.schema("hub").from("waitlist").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
