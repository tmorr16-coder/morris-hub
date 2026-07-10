"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

interface OnboardingData {
  persona: "parent" | "student" | "individual";
  displayName: string;
  locationName: string;
  appAccess: string[];
  // Coordinates resolved from the ZIP lookup — drive the Weather glance on Today.
  latitude?: number | null;
  longitude?: number | null;
  // Interests — all optional; captured on the "Your interests" step.
  stockTickers?: string[];
  employerTicker?: string | null;
  newsTopics?: string[];
  sportsTeams?: string[];
  cityNames?: string[];
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
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        app_access: data.appAccess,
        onboarding_completed: true,
        // Interests — persist whatever the user provided; empty arrays / null are fine.
        stock_tickers: data.stockTickers ?? [],
        employer_ticker: data.employerTicker ?? null,
        news_topics: data.newsTopics ?? [],
        sports_enabled_teams: data.sportsTeams ?? [],
        city_names: data.cityNames ?? [],
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[onboarding] save error:", error.message);
    return { error: error.message };
  }

  return {};
}
