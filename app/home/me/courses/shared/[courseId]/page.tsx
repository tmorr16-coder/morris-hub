export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IOSScreen, LargeTitle, Chip, TabBar, Icons } from "@/components/ios";
import SharedCourseClient from "./_components/SharedCourseClient";

export default async function SharedCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  // Note: no app_access check here — recipients don't need student-success
  // in their own prefs to view a course that was explicitly shared with them.

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

  if (!course) redirect("/home/me/courses");

  const isOwner = course.user_id === user.id;
  if (!isOwner && !share) redirect("/home/me/courses");

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

  return (
    <IOSScreen>
      <div className="ios-navbar">
        <Link href="/home/me/courses" className="ios-back">
          <Icons.ChevronLeft aria-hidden style={{ width: 20, height: 20 }} />
          Courses
        </Link>
      </div>

      <LargeTitle
        title={course.name}
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Chip small>{isOwner ? "Preview · your share page" : `Shared by ${ownerName}`}</Chip>
            {course.instructor && <span>{course.instructor}</span>}
          </span>
        }
      />

      <div style={{ padding: "0 16px" }}>
        <SharedCourseClient
          courseId={courseId}
          colorTag={course.color_tag}
          grades={grades}
          assignments={assignments}
          canViewGrades={canViewGrades}
          canViewAssignments={canViewAssignments}
        />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
