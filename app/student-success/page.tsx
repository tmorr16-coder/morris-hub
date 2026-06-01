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

  const [coursesResult, remindersResult, sharesResult, lsatSettingsResult] = await Promise.all([
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
    service
      .schema("student_support")
      .from("student_settings")
      .select("lsat_enabled, lsat_target_score")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const courses = coursesResult.data ?? [];
  const reminders = remindersResult.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lsatSettings = lsatSettingsResult.data as any;

  // Log shares error so it shows up in Vercel runtime logs
  if (sharesResult.error) {
    console.error("[student-success] course_shares query failed:", sharesResult.error.message, sharesResult.error.code);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawShares = (sharesResult.data ?? []) as any[];

  // Look up owner names from public.profiles (separate query — cross-schema joins
  // don't work via PostgREST when the FK points to auth.users)
  let ownerNames: Record<string, string> = {};
  if (rawShares.length > 0) {
    const ownerIds = [...new Set(rawShares.map((s: any) => s.owner_user_id as string))];
    const { data: profileRows } = await service
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ownerIds);
    for (const p of profileRows ?? []) {
      ownerNames[p.id] = p.full_name || p.email || "a family member";
    }
  }

  const sharedCourses = rawShares.map((s: any) => ({
    shareId: s.id,
    courseId: s.course_id,
    shareGrades: s.share_grades,
    shareAssignments: s.share_assignments,
    course: s.courses,
    ownerName: ownerNames[s.owner_user_id] ?? "a family member",
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
          {/* Left column: My Courses + Shared with me + LSAT Prep */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading courses...</div>}>
              <CoursesSection courses={courses} />
            </Suspense>

            {sharedCourses.length > 0 && (
              <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading shared...</div>}>
                <SharedCoursesSection sharedCourses={sharedCourses} />
              </Suspense>
            )}

            {/* LSAT Prep card — shown only when enabled, or as a teaser to enable */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, margin: 0 }}>
                  ⚖️ LSAT Prep
                </h2>
                {!lsatSettings?.lsat_enabled && (
                  <Link href="/student-success/settings" style={{
                    fontSize: 11, color: "var(--color-ink-3)", textDecoration: "none",
                    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-rule)",
                  }}>
                    Enable in Settings
                  </Link>
                )}
              </div>

              {lsatSettings?.lsat_enabled ? (
                <Link href="/student-success/lsat" style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "var(--color-bg-card)", border: "1px solid var(--color-accent)",
                    borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-ink)", marginBottom: 4 }}>
                        Error Log · Blind Review · Analytics
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                        {lsatSettings?.lsat_target_score ? `Target: ${lsatSettings.lsat_target_score}` : "Track every question · Calibrate your confidence"}
                      </div>
                    </div>
                    <span style={{ color: "var(--color-accent)", fontSize: 22 }}>›</span>
                  </div>
                </Link>
              ) : (
                <div style={{
                  background: "var(--color-bg-card)", border: "1px dashed var(--color-rule)",
                  borderRadius: 14, padding: "24px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
                  <div style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>LSAT prep, built for you</div>
                  <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 16, lineHeight: 1.5 }}>
                    Error log · blind review · confidence calibration · AI-powered explanations.
                    Based on the same methodology used by top scorers.
                  </div>
                  <Link href="/student-success/settings" style={{
                    display: "inline-block", padding: "8px 20px",
                    background: "var(--color-accent)", color: "#fff",
                    borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 500,
                  }}>
                    Enable LSAT Prep →
                  </Link>
                </div>
              )}
            </section>
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
