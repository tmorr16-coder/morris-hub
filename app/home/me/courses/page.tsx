export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";
import { getPreferences } from "@/lib/prefs";
import CoursesSection from "./_components/CoursesSection";
import UpcomingRemindersSection from "./_components/UpcomingRemindersSection";
import SharedCoursesSection from "./_components/SharedCoursesSection";

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check if user has access to the (internal) student-success flag
  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("student-success")) {
    redirect("/home/me");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [coursesResult, remindersResult, sharesResult] = await Promise.all([
    service
      .schema("student_support")
      .from("courses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    service
      .schema("student_support")
      .from("course_reminders")
      .select("*, courses:course_id(name, color_tag)")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true })
      .limit(10),
    // Courses shared with this user by others
    service
      .schema("student_support")
      .from("course_shares")
      .select("id, course_id, owner_user_id, share_grades, share_assignments, courses:course_id(id, name, instructor, semester, color_tag)")
      .eq("shared_with_user_id", user.id),
  ]);

  const courses = coursesResult.data ?? [];
  const reminders = remindersResult.data ?? [];

  // Log shares error so it shows up in Vercel runtime logs
  if (sharesResult.error) {
    console.error("[home/me/courses] course_shares query failed:", sharesResult.error.message, sharesResult.error.code);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawShares = (sharesResult.data ?? []) as any[];

  // Look up owner names from public.profiles (separate query — cross-schema joins
  // don't work via PostgREST when the FK points to auth.users)
  const ownerNames: Record<string, string> = {};
  if (rawShares.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerIds = [...new Set(rawShares.map((s: any) => s.owner_user_id as string))];
    const { data: profileRows } = await service
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ownerIds);
    for (const p of profileRows ?? []) {
      ownerNames[p.id] = p.full_name || p.email || "a family member";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedCourses = rawShares.map((s: any) => ({
    shareId: s.id,
    courseId: s.course_id,
    shareGrades: s.share_grades,
    shareAssignments: s.share_assignments,
    course: s.courses,
    ownerName: ownerNames[s.owner_user_id] ?? "a family member",
  }));

  return (
    <IOSScreen>
      <LargeTitle
        title="Courses"
        subtitle="Assignments, grades & study"
        avatarInitial={(user.user_metadata?.full_name ?? "T")[0]?.toUpperCase()}
      />

      <Group>
        <Cell
          lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>}
          title="Reminder settings"
          subtitle="SMS reminders & lead time"
          href="/home/me/courses/settings"
        />
      </Group>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "8px 16px 0" }}>
        <Suspense fallback={<div style={{ color: "var(--ios-label-2)" }}>Loading courses...</div>}>
          <CoursesSection courses={courses} />
        </Suspense>

        {sharedCourses.length > 0 && (
          <Suspense fallback={<div style={{ color: "var(--ios-label-2)" }}>Loading shared...</div>}>
            <SharedCoursesSection sharedCourses={sharedCourses} />
          </Suspense>
        )}

        <Suspense fallback={<div style={{ color: "var(--ios-label-2)" }}>Loading reminders...</div>}>
          <UpcomingRemindersSection reminders={reminders} />
        </Suspense>
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
