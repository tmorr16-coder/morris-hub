"use server";

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET — invitations pending for the current user's email
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ pending: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data } = await service
    .schema("hub")
    .from("family_invitations")
    .select("id, inviter_id, display_name, role, created_at")
    .eq("invite_email", user.email.toLowerCase())
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return NextResponse.json({ pending: data ?? [] });
}
