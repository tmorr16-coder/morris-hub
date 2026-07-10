import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST: log an interaction with a relationship
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
    relationship_id,
    interaction_date,
    interaction_type,
    notes,
    insights,
    action_items,
    linked_goal_ids,
  } = body;

  if (!relationship_id) {
    return NextResponse.json({ error: "relationship_id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify the parent relationship belongs to the caller before logging against it
  const { data: relationship } = await db
    .schema("career")
    .from("career_relationships")
    .select("id, user_id")
    .eq("id", relationship_id)
    .maybeSingle();

  if (!relationship) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }
  if (relationship.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await db
    .schema("career")
    .from("career_interactions")
    .insert([
      {
        user_id: user.id,
        relationship_id,
        interaction_date: interaction_date ?? null,
        interaction_type: interaction_type ?? "1on1",
        notes: notes ?? null,
        insights: insights ?? null,
        action_items: action_items ?? [],
        linked_goal_ids: linked_goal_ids ?? [],
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[career/relationships/interactions POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
