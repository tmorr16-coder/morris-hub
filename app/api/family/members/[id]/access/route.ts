import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const VALID_MODULES = ["hub", "health", "finance", "investments", "career", "student-success", "bible"];

// PATCH — a parent edits which modules a child circle member can access.
// [id] is the child's auth.users id (member_user_id on the parent's circle row).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: childId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { app_access } = await req.json().catch(() => ({}));
  if (!Array.isArray(app_access) || app_access.some((m) => !VALID_MODULES.includes(m))) {
    return NextResponse.json({ error: "app_access must be an array of valid module keys" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Authorization: requester must be this child's parent (own a circle row
  // pointing at the child with role='child').
  const { data: link } = await service.schema("hub").from("family_members")
    .select("id").eq("user_id", user.id).eq("member_user_id", childId).eq("role", "child").maybeSingle();
  if (!link) return NextResponse.json({ error: "Not authorized to edit this member's access" }, { status: 403 });

  const { error } = await service.schema("hub").from("preferences")
    .upsert({ user_id: childId, app_access }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
