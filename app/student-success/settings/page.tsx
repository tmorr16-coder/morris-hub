export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/app/home/_components/SignOutButton";
import PlatformMenu from "@/components/PlatformMenu";
import { Suspense } from "react";
import { getPreferences } from "@/lib/prefs";
import StudentSettingsForm from "./_components/StudentSettingsForm";

export default async function StudentSuccessSettingsPage() {
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

  // Fetch student-specific settings
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
    isAdmin: false,
  };

  return (
    <div>
      <PlatformMenu currentApp="student-success" user={menuUser} />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <Link
              href="/student-success"
              style={{ color: "var(--color-accent)", fontSize: 12, marginBottom: 12, display: "inline-block", textDecoration: "none" }}
            >
              ← Back to Student Success
            </Link>
            <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, marginBottom: 8 }}>
              Settings
            </h1>
            <p style={{ color: "var(--color-ink-3)", fontSize: 14 }}>Configure your reminder preferences and contact information</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SignOutButton />
          </div>
        </div>

        <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading settings...</div>}>
          <StudentSettingsForm initialSettings={studentSettings || {}} />
        </Suspense>
      </main>
    </div>
  );
}
