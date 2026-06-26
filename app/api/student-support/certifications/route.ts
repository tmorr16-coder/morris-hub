import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: fetch user's cert_exams ordered by created_at desc
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: create cert_exam (with optional domains array)
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
    name,
    vendor,
    exam_code,
    description,
    color_tag,
    passing_score_pct,
    target_exam_date,
    domains,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: exam, error: examErr } = await db
    .schema("student_support")
    .from("cert_exams")
    .insert([
      {
        user_id: user.id,
        name,
        vendor: vendor ?? null,
        exam_code: exam_code ?? null,
        description: description ?? null,
        color_tag: color_tag ?? "#3b82f6",
        passing_score_pct: passing_score_pct ?? null,
        target_exam_date: target_exam_date ?? null,
      },
    ])
    .select()
    .single();

  if (examErr) {
    console.error("[certifications POST] exam insert error:", examErr.message);
    return NextResponse.json({ error: examErr.message }, { status: 500 });
  }

  // Insert domains if provided
  if (Array.isArray(domains) && domains.length > 0) {
    const domainRows = domains.map((d: { name: string; description?: string; weight_pct?: number }) => ({
      exam_id: exam.id,
      name: d.name,
      description: d.description ?? null,
      weight_pct: d.weight_pct ?? null,
    }));

    const { error: domainErr } = await db
      .schema("student_support")
      .from("cert_domains")
      .insert(domainRows);

    if (domainErr) {
      console.error("[certifications POST] domain insert error:", domainErr.message);
      // Don't fail the whole request — exam was created
      return NextResponse.json({ ...exam, domainsError: domainErr.message }, { status: 201 });
    }
  }

  return NextResponse.json(exam, { status: 201 });
}
