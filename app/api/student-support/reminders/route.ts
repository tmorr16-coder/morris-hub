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
  const courseId = searchParams.get("courseId");
  const includeCompleted = searchParams.get("includeCompleted") === "true";

  let query = service
    .schema("student_support")
    .from("course_reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  if (!includeCompleted) {
    query = query.eq("is_completed", false);
  }

  const { data, error } = await query;

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
  const { courseId, type, title, description, due_date, due_time } = body;

  if (!courseId || !type || !title || !due_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify course ownership
  const { data: course } = await service
    .schema("student_support")
    .from("courses")
    .select("user_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .schema("student_support")
    .from("course_reminders")
    .insert([
      {
        user_id: user.id,
        course_id: courseId,
        type,
        title,
        description,
        due_date,
        due_time,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0], { status: 201 });
}
