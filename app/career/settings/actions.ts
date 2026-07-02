"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function saveLsatSettings({
  lsatEnabled,
  lsatTargetScore,
}: {
  lsatEnabled: boolean;
  lsatTargetScore: number | null;
}): Promise<{ error?: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { error: "Not authenticated" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    const { error } = await service
      .schema("student_support")
      .from("student_settings")
      .upsert(
        {
          user_id: userId,
          lsat_enabled: lsatEnabled,
          lsat_target_score: lsatEnabled ? lsatTargetScore : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("saveLsatSettings error:", error);
      return { error: "Failed to save settings" };
    }
    return {};
  } catch (err) {
    console.error("saveLsatSettings unexpected error:", err);
    return { error: "An unexpected error occurred" };
  }
}
