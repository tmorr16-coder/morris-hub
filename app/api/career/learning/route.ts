import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: list learning items, also fetching cert_exams from student_support schema
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Fetch career_learning items and cert_exams in parallel
  const [learningResult, certExamsResult] = await Promise.all([
    db
      .schema("career")
      .from("career_learning")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .schema("student_support")
      .from("cert_exams")
      .select("id, name, vendor, exam_code, target_exam_date, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (learningResult.error) {
    console.error("[career/learning GET] learning error:", learningResult.error.message);
    return NextResponse.json({ error: learningResult.error.message }, { status: 500 });
  }

  const learningItems = learningResult.data ?? [];

  // Convert cert_exams into learning-item shape with type='certification'
  const certItems = (certExamsResult.data ?? []).map((exam: any) => ({
    id: exam.id,
    user_id: user.id,
    title: exam.name + (exam.exam_code ? ` (${exam.exam_code})` : ""),
    learning_type: "certification",
    provider: exam.vendor ?? null,
    start_date: null,
    end_date: exam.target_exam_date ?? null,
    status: "planned",
    cert_exam_id: exam.id,
    linked_goal_ids: [],
    notes: null,
    url: null,
    created_at: exam.created_at,
    updated_at: exam.created_at,
    _source: "cert_exam",
  }));

  // Merge: career_learning items first, then cert_exams not already linked
  const linkedCertIds = new Set(
    learningItems
      .filter((item: any) => item.cert_exam_id)
      .map((item: any) => item.cert_exam_id)
  );

  const unlinkedCerts = certItems.filter(
    (item: any) => !linkedCertIds.has(item.cert_exam_id)
  );

  return NextResponse.json([...learningItems, ...unlinkedCerts]);
}

// POST: create learning item
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
    learning_type,
    provider,
    start_date,
    end_date,
    status,
    linked_goal_ids,
    notes,
    url,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("career")
    .from("career_learning")
    .insert([
      {
        user_id: user.id,
        title,
        learning_type: learning_type ?? "course",
        provider: provider ?? null,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        status: status ?? "planned",
        linked_goal_ids: linked_goal_ids ?? [],
        notes: notes ?? null,
        url: url ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[career/learning POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
