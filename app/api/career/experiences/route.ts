import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: list user's experiences, newest first. Optional ?goalId= filter.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get("goalId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  let query = db
    .schema("career")
    .from("career_experiences")
    .select("*")
    .eq("user_id", user.id)
    .order("experience_date", { ascending: false });

  if (goalId) {
    // Filter by linked_goal_ids array containing the goalId
    query = query.contains("linked_goal_ids", [goalId]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[career/experiences GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST: create experience
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    experience_date,
    experience_type,
    reflection,
    impact,
    skills_developed,
    linked_goal_ids,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("career")
    .from("career_experiences")
    .insert([
      {
        user_id: user.id,
        title,
        description: description ?? null,
        experience_date: experience_date ?? undefined,
        experience_type: experience_type ?? "project",
        reflection: reflection ?? null,
        impact: impact ?? null,
        skills_developed: skills_developed ?? [],
        linked_goal_ids: linked_goal_ids ?? [],
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[career/experiences POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
