"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function saveCourseReminderSettings({
  phoneNumber,
  smsEnabled,
  reminderLeadDays,
}: {
  phoneNumber: string | null;
  smsEnabled: boolean;
  reminderLeadDays: number;
}): Promise<{ error?: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { error: "Not authenticated" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    if (phoneNumber?.trim() && !/^\+\d{1,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
      return { error: "Phone number must be in E.164 format (e.g., +12125552368)" };
    }

    const { error } = await service
      .schema("student_support")
      .from("student_settings")
      .upsert(
        {
          user_id: userId,
          phone_number: phoneNumber,
          sms_notifications_enabled: smsEnabled,
          reminder_lead_days: reminderLeadDays,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("saveCourseReminderSettings error:", error);
      return { error: "Failed to save settings" };
    }
    return {};
  } catch (err) {
    console.error("saveCourseReminderSettings unexpected error:", err);
    return { error: "An unexpected error occurred" };
  }
}
