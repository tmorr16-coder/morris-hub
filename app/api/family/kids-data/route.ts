"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/family/kids-data?member_id=UUID
// Returns courses + upcoming assignments for a child family member.
// Access is gated: requestor must have member_id in their family circle with role='child'.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const memberId = req.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify the requestor is the parent of this child in their circle
  const { data: memberRecord } = await service
    .schema("hub")
    .from("family_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("member_user_id", memberId)
    .eq("role", "child")
    .maybeSingle();

  if (!memberRecord) {
    return NextResponse.json({ error: "Access denied — not a child member of your circle" }, { status: 403 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [coursesResult, assignmentsResult] = await Promise.all([
    service
      .schema("student_support")
      .from("courses")
      .select("id, name, instructor, color_tag, created_at")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .schema("student_support")
      .from("course_reminders")
      .select("id, type, title, due_date, due_time, is_completed, course_id, course:courses(name, color_tag)")
      .eq("user_id", memberId)
      .eq("is_completed", false)
      .lte("due_date", horizon)
      .gte("due_date", now.toISOString().slice(0, 10))
      .order("due_date", { ascending: true })
      .limit(10),
  ]);

  return NextResponse.json({
    courses: coursesResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
  });
}
