import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { type, title, description, due_date, due_time, is_completed } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership
  const { data: reminder } = await service
    .schema("student_support")
    .from("course_reminders")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!reminder || reminder.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (type !== undefined) updateData.type = type;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (due_time !== undefined) updateData.due_time = due_time;
  if (is_completed !== undefined) {
    updateData.is_completed = is_completed;
    if (is_completed) {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }
  }

  const { data, error } = await service
    .schema("student_support")
    .from("course_reminders")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership
  const { data: reminder } = await service
    .schema("student_support")
    .from("course_reminders")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!reminder || reminder.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .schema("student_support")
    .from("course_reminders")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
