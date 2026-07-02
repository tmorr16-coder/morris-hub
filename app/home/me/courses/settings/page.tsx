export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlatformMenu from "@/components/PlatformMenu";
import { Suspense } from "react";
import { getPreferences } from "@/lib/prefs";
import CourseReminderSettingsForm from "./_components/CourseReminderSettingsForm";

export default async function CourseReminderSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("student-success")) {
    redirect("/home/me");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: studentSettings } = await service
    .schema("student_support")
    .from("student_settings")
    .select("phone_number, sms_notifications_enabled, reminder_lead_days")
    .eq("user_id", user.id)
    .maybeSingle();

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="health" user={menuUser} />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px 100px" }}>
        <Link href="/home/me/courses" style={{ color: "var(--color-accent)", fontSize: 12, marginBottom: 12, display: "inline-block", textDecoration: "none" }}>
          ← Back to Courses
        </Link>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>Course reminder settings</h1>
        <p style={{ color: "var(--color-ink-3)", fontSize: 14, marginBottom: 24 }}>Configure SMS reminders and contact information for course due dates.</p>

        <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading settings...</div>}>
          <CourseReminderSettingsForm initialSettings={studentSettings || {}} />
        </Suspense>
      </main>
    </div>
  );
}
