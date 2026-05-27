import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { searchParams } = new URL(request.url);
  const setId = searchParams.get("setId");

  if (!setId) {
    return NextResponse.json({ error: "Set ID is required" }, { status: 400 });
  }

  // Verify set ownership
  const { data: set } = await service
    .schema("student_support")
    .from("flashcard_sets")
    .select("user_id")
    .eq("id", setId)
    .maybeSingle();

  if (!set || set.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .schema("student_support")
    .from("flashcards")
    .select("*")
    .eq("set_id", setId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { setId, question, answer, context, difficulty } = body;

  if (!setId || !question || !answer) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify set ownership
  const { data: set } = await service
    .schema("student_support")
    .from("flashcard_sets")
    .select("user_id")
    .eq("id", setId)
    .maybeSingle();

  if (!set || set.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .schema("student_support")
    .from("flashcards")
    .insert([
      {
        user_id: user.id,
        set_id: setId,
        question,
        answer,
        context,
        difficulty: difficulty || 1,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0], { status: 201 });
}
