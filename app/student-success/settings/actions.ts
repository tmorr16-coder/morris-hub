"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function saveStudentSettings({
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
    if (!userId) {
      return { error: "Not authenticated" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    // Validate phone number if provided
    if (phoneNumber && phoneNumber.trim()) {
      // E.164 format: +[country code][number]
      if (!/^\+\d{1,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
        return { error: "Phone number must be in E.164 format (e.g., +12125552368)" };
      }
    }

    // Upsert student settings
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
      console.error("Failed to save student settings:", error);
      return { error: "Failed to save settings" };
    }

    return {};
  } catch (err) {
    console.error("Error in saveStudentSettings:", err);
    return { error: "An unexpected error occurred" };
  }
}
