"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

interface OnboardingData {
  persona: "parent" | "student" | "individual";
  displayName: string;
  locationName: string;
  appAccess: string[];
}

export async function completeOnboarding(data: OnboardingData): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error } = await service
    .schema("hub")
    .from("preferences")
    .upsert(
      {
        user_id: userId,
        persona: data.persona,
        display_name: data.displayName,
        location_name: data.locationName,
        app_access: data.appAccess,
        onboarding_completed: true,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[onboarding] save error:", error.message);
    return { error: error.message };
  }

  return {};
}
