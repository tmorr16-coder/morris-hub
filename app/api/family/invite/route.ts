"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST — send a family circle invitation
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { invite_email, display_name, role } = await req.json().catch(() => ({}));
  if (!invite_email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (invite_email.toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "You can't invite yourself" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Upsert invitation (idempotent — re-inviting resets status to pending)
  const { data, error } = await service
    .schema("hub")
    .from("family_invitations")
    .upsert(
      {
        inviter_id: user.id,
        invite_email: invite_email.toLowerCase(),
        display_name: display_name?.trim() || null,
        role: role === "child" ? "child" : "adult",
        status: "pending",
        responded_at: null,
      },
      { onConflict: "inviter_id,invite_email" }
    )
    .select("id, invite_email, display_name, role, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, invite: data });
}

// GET — list invitations sent by the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data, error } = await service
    .schema("hub")
    .from("family_invitations")
    .select("id, invite_email, display_name, role, status, created_at, responded_at")
    .eq("inviter_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}
