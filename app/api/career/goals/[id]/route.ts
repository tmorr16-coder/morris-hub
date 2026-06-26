import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: single goal with milestones and recent notes (limit 10)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Fetch goal, milestones, and recent notes in parallel
  const [goalResult, milestonesResult, notesResult] = await Promise.all([
    db
      .schema("career")
      .from("career_goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    db
      .schema("career")
      .from("career_milestones")
      .select("*")
      .eq("goal_id", id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    db
      .schema("career")
      .from("career_goal_notes")
      .select("*")
      .eq("goal_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (goalResult.error) {
    if (goalResult.error.code === "PGRST116") {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ error: goalResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ...goalResult.data,
    milestones: milestonesResult.data ?? [],
    notes: notesResult.data ?? [],
  });
}

// PATCH: update goal fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Allow only specific fields
  const allowedFields = [
    "title",
    "description",
    "why",
    "success_criteria",
    "category",
    "horizon",
    "target_date",
    "status",
    "progress_pct",
    "color_tag",
    "sort_order",
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify ownership first
  const { data: existing, error: checkError } = await db
    .schema("career")
    .from("career_goals")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (checkError || !existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const { data, error } = await db
    .schema("career")
    .from("career_goals")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("[career/goals/[id] PATCH] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: delete goal (cascades to milestones + notes)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify ownership
  const { data: existing, error: checkError } = await db
    .schema("career")
    .from("career_goals")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (checkError || !existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const { error } = await db
    .schema("career")
    .from("career_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[career/goals/[id] DELETE] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
