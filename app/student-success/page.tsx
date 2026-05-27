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

export default async function StudentSupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check if user has access to student-success module
  const prefs = await getPreferences();
  if (!prefs.app_access?.includes("student-success")) {
    redirect("/home");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [coursesResult, remindersResult] = await Promise.all([
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
  ]);

  const courses = coursesResult.data ?? [];
  const reminders = remindersResult.data ?? [];

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
          {/* Left column: Courses */}
          <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading courses...</div>}>
            <CoursesSection courses={courses} />
          </Suspense>

          {/* Right column: Upcoming reminders */}
          <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading reminders...</div>}>
            <UpcomingRemindersSection reminders={reminders} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
