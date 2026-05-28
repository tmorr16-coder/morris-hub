import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── PATCH: update a single schedule item (title, date, completed, etc.) ──────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Whitelist editable fields
  const allowed = ["title", "description", "item_type", "scheduled_date", "duration_minutes", "is_completed", "sort_order"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (body.is_completed === true && !body.completed_at) {
    updates.completed_at = new Date().toISOString();
  } else if (body.is_completed === false) {
    updates.completed_at = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership via join
  const { data: item } = await service
    .schema("student_support").from("schedule_items")
    .select("id, schedule_id")
    .eq("id", id).maybeSingle();

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: schedule } = await service
    .schema("student_support").from("course_schedules")
    .select("user_id").eq("id", item.schedule_id).maybeSingle();

  if (!schedule || schedule.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error } = await service
    .schema("student_support").from("schedule_items")
    .update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updated);
}

// ── DELETE: remove a single schedule item ────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership
  const { data: item } = await service
    .schema("student_support").from("schedule_items")
    .select("schedule_id").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: schedule } = await service
    .schema("student_support").from("course_schedules")
    .select("user_id").eq("id", item.schedule_id).maybeSingle();
  if (!schedule || schedule.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await service.schema("student_support").from("schedule_items").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
