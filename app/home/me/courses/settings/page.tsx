export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IOSScreen, LargeTitle, TabBar, Icons } from "@/components/ios";
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

  return (
    <IOSScreen>
      <div className="ios-navbar">
        <Link href="/home/me/courses" className="ios-back">
          <Icons.ChevronLeft aria-hidden style={{ width: 20, height: 20 }} />
          Courses
        </Link>
      </div>

      <LargeTitle title="Reminder settings" subtitle="SMS reminders for course due dates" />

      <div style={{ padding: "0 16px" }}>
        <Suspense fallback={<div style={{ color: "var(--ios-label-2)" }}>Loading settings...</div>}>
          <CourseReminderSettingsForm initialSettings={studentSettings || {}} />
        </Suspense>
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
