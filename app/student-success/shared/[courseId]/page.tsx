export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlatformMenu from "@/components/PlatformMenu";
import SharedCourseClient from "./_components/SharedCourseClient";

export default async function SharedCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { courseId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Check if this user has been granted access to this course
  const { data: share } = await service
    .schema("student_support")
    .from("course_shares")
    .select("share_grades, share_assignments, owner_user_id")
    .eq("course_id", courseId)
    .eq("shared_with_user_id", user.id)
    .maybeSingle();

  // Also allow the owner to preview their own share page
  const { data: course } = await service
    .schema("student_support")
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) redirect("/student-success");

  const isOwner = course.user_id === user.id;
  if (!isOwner && !share) redirect("/student-success");

  const canViewGrades = isOwner || share?.share_grades;
  const canViewAssignments = isOwner || share?.share_assignments;

  // Fetch owner's profile name for display
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("full_name, email")
    .eq("id", course.user_id)
    .maybeSingle();

  const ownerName = ownerProfile?.full_name || ownerProfile?.email || "a classmate";

  // Fetch grades if allowed
  const gradesPromise = canViewGrades
    ? service
        .schema("student_support")
        .from("grade_components")
        .select("*")
        .eq("course_id", courseId)
        .eq("user_id", course.user_id)
        .order("sort_order", { ascending: true })
    : Promise.resolve({ data: [] });

  // Fetch assignments/reminders if allowed
  const assignmentsPromise = canViewAssignments
    ? service
        .schema("student_support")
        .from("course_reminders")
        .select("*")
        .eq("course_id", courseId)
        .eq("user_id", course.user_id)
        .order("due_date", { ascending: true })
    : Promise.resolve({ data: [] });

  const [gradesResult, assignmentsResult] = await Promise.all([
    gradesPromise,
    assignmentsPromise,
  ]);

  const grades = gradesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: false,
  };

  return (
    <div style={{ background: "var(--color-bg)" }}>
      <PlatformMenu currentApp="student-success" user={menuUser} />

      {/* Course header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${course.color_tag}15 0%, ${course.color_tag}05 100%)`,
          borderBottom: `2px solid ${course.color_tag}`,
          padding: "20px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/student-success"
            style={{
              color: "var(--color-accent-dark)",
              textDecoration: "none",
              fontSize: 13,
              marginBottom: 12,
              display: "inline-block",
            }}
          >
            ← Back to Student Success
          </Link>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h1 className="serif" style={{ fontSize: 36, margin: "0 0 8px 0", color: course.color_tag }}>
              {course.name}
            </h1>
            {!isOwner && (
              <span style={{
                fontSize: 12,
                color: "var(--color-ink-3)",
                background: "var(--color-paper-deep)",
                border: "1px solid var(--color-rule)",
                borderRadius: 20,
                padding: "3px 10px",
              }}>
                Shared by {ownerName}
              </span>
            )}
            {isOwner && (
              <span style={{
                fontSize: 12,
                color: course.color_tag,
                background: course.color_tag + "15",
                border: `1px solid ${course.color_tag}30`,
                borderRadius: 20,
                padding: "3px 10px",
              }}>
                Preview (your share page)
              </span>
            )}
          </div>
          {course.instructor && (
            <p style={{ color: "var(--color-ink-3)", margin: 0 }}>📚 {course.instructor}</p>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 80px" }}>
        <SharedCourseClient
          courseId={courseId}
          colorTag={course.color_tag}
          grades={grades}
          assignments={assignments}
          canViewGrades={canViewGrades}
          canViewAssignments={canViewAssignments}
        />
      </main>
    </div>
  );
}
