export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/app/home/_components/SignOutButton";
import PlatformMenu from "@/components/PlatformMenu";
import { Suspense } from "react";
import { getPreferences } from "@/lib/prefs";
import CoursesSection from "./_components/CoursesSection";
import UpcomingRemindersSection from "./_components/UpcomingRemindersSection";
import SharedCoursesSection from "./_components/SharedCoursesSection";

export default async function StudentSupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check if user has access to student-success module
  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("student-success")) {
    redirect("/home");
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
      .select("id, course_id, share_grades, share_assignments, courses:course_id(id, name, instructor, semester, color_tag), profiles:owner_user_id(full_name, email)")
      .eq("shared_with_user_id", user.id),
  ]);

  const courses = coursesResult.data ?? [];
  const reminders = remindersResult.data ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedCourses = (sharesResult.data ?? []).map((s: any) => ({
    shareId: s.id,
    courseId: s.course_id,
    shareGrades: s.share_grades,
    shareAssignments: s.share_assignments,
    course: s.courses,
    ownerName: s.profiles?.full_name || s.profiles?.email || "a family member",
  }));

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: false,
  };

  return (
    <div>
      <PlatformMenu currentApp="student-success" user={menuUser} />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, marginBottom: 8 }}>
              Student Success
            </h1>
            <p style={{ color: "var(--color-ink-3)", fontSize: 14 }}>Manage courses, track assignments, and study smarter</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/student-success/settings"
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--color-rule)",
                background: "transparent",
                color: "var(--color-ink-2)",
                fontSize: 12,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              ⚙ Settings
            </Link>
            <SignOutButton />
          </div>
        </div>

        {/* Grid layout for sections */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
          {/* Left column: My Courses + Shared with me */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading courses...</div>}>
              <CoursesSection courses={courses} />
            </Suspense>

            {sharedCourses.length > 0 && (
              <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading shared...</div>}>
                <SharedCoursesSection sharedCourses={sharedCourses} />
              </Suspense>
            )}
          </div>

          {/* Right column: Upcoming reminders */}
          <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading reminders...</div>}>
            <UpcomingRemindersSection reminders={reminders} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
