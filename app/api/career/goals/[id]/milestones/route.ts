import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function verifyGoalOwnership(goalId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data, error } = await db
    .schema("career")
    .from("career_goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .single();
  return { owned: !error && !!data };
}

// GET: list milestones for goal
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

  const { owned } = await verifyGoalOwnership(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("career")
    .from("career_milestones")
    .select("*")
    .eq("goal_id", id)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[career/goals/[id]/milestones GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST: add milestone
export async function POST(
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

  const { owned } = await verifyGoalOwnership(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, target_date, sort_order } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("career")
    .from("career_milestones")
    .insert([
      {
        goal_id: id,
        user_id: user.id,
        title,
        target_date: target_date ?? null,
        sort_order: sort_order ?? 0,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[career/goals/[id]/milestones POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH: update milestone — body must include id
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

  const { owned } = await verifyGoalOwnership(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const body = await request.json();
  const { id: milestoneId, title, target_date, completed, sort_order } = body;

  if (!milestoneId) {
    return NextResponse.json({ error: "milestone id is required in body" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (target_date !== undefined) updates.target_date = target_date;
  if (completed !== undefined) {
    updates.completed = completed;
    updates.completed_at = completed ? new Date().toISOString() : null;
  }
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await db
    .schema("career")
    .from("career_milestones")
    .update(updates)
    .eq("id", milestoneId)
    .eq("goal_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("[career/goals/[id]/milestones PATCH] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: delete milestone — uses ?milestoneId= query param
export async function DELETE(
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

  const { owned } = await verifyGoalOwnership(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const milestoneId = searchParams.get("milestoneId");

  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId query param is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { error } = await db
    .schema("career")
    .from("career_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("goal_id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[career/goals/[id]/milestones DELETE] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
