import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST: create cert_session
export async function POST(
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

  const { id: examId } = await params;
  const body = await request.json();
  const { mode, domainId, questionCount, timeLimitS } = body;

  if (!mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  if (!questionCount || questionCount < 1) {
    return NextResponse.json({ error: "questionCount must be at least 1" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify exam ownership
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("id")
    .eq("id", examId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: session, error } = await db
    .schema("student_support")
    .from("cert_sessions")
    .insert({
      exam_id: examId,
      user_id: user.id,
      mode,
      domain_id: domainId ?? null,
      question_count: questionCount,
      time_limit_s: timeLimitS ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[certifications/sessions POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(session, { status: 201 });
}

// GET: list sessions for exam
export async function GET(
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

  const { id: examId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify exam ownership
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("id")
    .eq("id", examId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await db
    .schema("student_support")
    .from("cert_sessions")
    .select("*")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
