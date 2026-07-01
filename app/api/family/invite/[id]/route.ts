"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// PATCH — accept or decline an invitation (called by the invitee)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action } = await req.json().catch(() => ({})); // "accept" | "decline"
  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Fetch the invite — it must be addressed to this user's email
  const { data: invite, error: fetchErr } = await service
    .schema("hub")
    .from("family_invitations")
    .select("*")
    .eq("id", id)
    .eq("invite_email", user.email?.toLowerCase() ?? "")
    .eq("status", "pending")
    .single();

  if (fetchErr || !invite) {
    return NextResponse.json({ error: "Invitation not found or already responded" }, { status: 404 });
  }

  // Update invitation status
  await service
    .schema("hub")
    .from("family_invitations")
    .update({ status: action === "accept" ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", id);

  if (action === "accept") {
    // Create bidirectional family_members entries
    await service
      .schema("hub")
      .from("family_members")
      .upsert([
        // Inviter → this user (with the role assigned by the inviter)
        {
          user_id: invite.inviter_id,
          member_user_id: user.id,
          role: invite.role,
          display_name: invite.display_name,
          birth_year: invite.birth_year ?? null,
        },
        // This user → inviter
        {
          user_id: user.id,
          member_user_id: invite.inviter_id,
          role: "adult",
          display_name: null,
        },
      ], { onConflict: "user_id,member_user_id", ignoreDuplicates: true });

    // ── Phase 3: enforce role-based app_access ────────────────────────────
    // Child members get a restricted module set. This is set explicitly so
    // getPreferences cannot auto-expand it back to the full adult set.
    if (invite.role === "child") {
      const CHILD_MODULES = ["hub", "health", "student-success", "bible"];
      await service
        .schema("hub")
        .from("preferences")
        .upsert(
          { user_id: user.id, app_access: CHILD_MODULES },
          { onConflict: "user_id" }
        );
    }
  }

  return NextResponse.json({ ok: true, action });
}

// DELETE — inviter cancels the invitation
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error } = await service
    .schema("hub")
    .from("family_invitations")
    .delete()
    .eq("id", id)
    .eq("inviter_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
