import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: fetch single cert_exam with domains, question count, session count
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

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: exam, error: examErr } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (examErr || !exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: domains } = await db
    .schema("student_support")
    .from("cert_domains")
    .select("*")
    .eq("exam_id", id)
    .order("created_at", { ascending: true });

  const { count: questionCount } = await db
    .schema("student_support")
    .from("cert_questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", id);

  const { count: sessionCount } = await db
    .schema("student_support")
    .from("cert_sessions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", id)
    .eq("user_id", user.id);

  return NextResponse.json({
    ...exam,
    domains: domains ?? [],
    questionCount: questionCount ?? 0,
    sessionCount: sessionCount ?? 0,
  });
}

// PATCH: update cert_exam fields
export async function PATCH(
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

  const allowed = [
    "name",
    "vendor",
    "exam_code",
    "description",
    "color_tag",
    "passing_score_pct",
    "target_exam_date",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("student_support")
    .from("cert_exams")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: delete cert_exam (cascades)
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
  const db = createServiceClient() as any;

  const { error } = await db
    .schema("student_support")
    .from("cert_exams")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
