import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: fetch session with attempts count and questions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: examId, sessionId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Fetch session scoped to user
  const { data: session, error: sessionErr } = await db
    .schema("student_support")
    .from("cert_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Count attempts
  const { count: attemptsCount } = await db
    .schema("student_support")
    .from("cert_attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  // Fetch questions for this session's exam (optionally filtered by domain)
  let questionsQuery = db
    .schema("student_support")
    .from("cert_questions")
    .select("id, stem, explanation, difficulty, domain_id, cert_choices(id, label, body, is_correct)")
    .eq("exam_id", examId);

  if (session.domain_id) {
    questionsQuery = questionsQuery.eq("domain_id", session.domain_id);
  }

  const { data: questions } = await questionsQuery.order("created_at", { ascending: true });

  return NextResponse.json({
    ...session,
    attemptsCount: attemptsCount ?? 0,
    questions: questions ?? [],
  });
}

// PATCH: end session (set ended_at)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: examId, sessionId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("student_support")
    .from("cert_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
