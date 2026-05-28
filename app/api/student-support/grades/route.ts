import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── GET: fetch all grade_components for a course ─────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data, error } = await service
    .schema("student_support")
    .from("grade_components")
    .select("*")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ── POST: create a new grade component ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { courseId, category, weight, points_earned, points_possible, notes, sort_order } = body;

  if (!courseId || !category || weight === undefined) {
    return NextResponse.json({ error: "courseId, category, and weight are required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data, error } = await service
    .schema("student_support")
    .from("grade_components")
    .insert([
      {
        user_id: user.id,
        course_id: courseId,
        category,
        weight,
        points_earned: points_earned ?? null,
        points_possible: points_possible ?? null,
        notes: notes ?? null,
        sort_order: sort_order ?? 0,
      },
    ])
    .select();

  if (error) {
    console.error("[student-support/grades POST] Supabase error:", error.message, error.code, error.details);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json(data[0], { status: 201 });
}

// ── PATCH: update a grade component ──────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, category, weight, points_earned, points_possible, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership
  const { data: existing } = await service
    .schema("student_support")
    .from("grade_components")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (category !== undefined) updates.category = category;
  if (weight !== undefined) updates.weight = weight;
  if (points_earned !== undefined) updates.points_earned = points_earned;
  if (points_possible !== undefined) updates.points_possible = points_possible;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await service
    .schema("student_support")
    .from("grade_components")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    console.error("[student-support/grades PATCH] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0]);
}

// ── DELETE: delete a grade component ─────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership
  const { data: existing } = await service
    .schema("student_support")
    .from("grade_components")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .schema("student_support")
    .from("grade_components")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
