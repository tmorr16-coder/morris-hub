import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── GET: fetch all shares for a course (owner view) ──────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

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
    .from("course_shares")
    .select("id, shared_with_user_id, share_grades, share_assignments, created_at")
    .eq("course_id", courseId)
    .eq("owner_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// ── POST: create or update a share ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { courseId, sharedWithUserId, shareGrades, shareAssignments } = body;

  if (!courseId || !sharedWithUserId) {
    return NextResponse.json({ error: "courseId and sharedWithUserId required" }, { status: 400 });
  }

  // Prevent sharing with yourself
  if (sharedWithUserId === user.id) {
    return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
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

  // Upsert the share record
  const { data, error } = await service
    .schema("student_support")
    .from("course_shares")
    .upsert(
      {
        course_id: courseId,
        owner_user_id: user.id,
        shared_with_user_id: sharedWithUserId,
        share_grades: shareGrades ?? true,
        share_assignments: shareAssignments ?? true,
      },
      { onConflict: "course_id,shared_with_user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[shares POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// ── DELETE: remove a share ────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership
  const { data: share } = await service
    .schema("student_support")
    .from("course_shares")
    .select("owner_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!share || share.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .schema("student_support")
    .from("course_shares")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
