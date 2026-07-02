import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const ALL_MODULES = ["hub", "health", "finance", "investments", "career", "student-success", "bible"];

// PATCH — a parent gives a child (typically one who's turned 18) full
// adult-style privacy: role flips to 'adult' and their app_access resets to
// everything. Explicit and parent-initiated — never automatic, since role
// changes affect parent-read RLS elsewhere (e.g. student_support course data).
export async function PATCH(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: childId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: link } = await service.schema("hub").from("family_members")
    .select("id").eq("user_id", user.id).eq("member_user_id", childId).eq("role", "child").maybeSingle();
  if (!link) return NextResponse.json({ error: "Not authorized to update this member" }, { status: 403 });

  const { error: roleError } = await service.schema("hub").from("family_members")
    .update({ role: "adult" }).eq("id", link.id);
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 });

  const { error: prefsError } = await service.schema("hub").from("preferences")
    .upsert({ user_id: childId, app_access: ALL_MODULES }, { onConflict: "user_id" });
  if (prefsError) return NextResponse.json({ error: prefsError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
