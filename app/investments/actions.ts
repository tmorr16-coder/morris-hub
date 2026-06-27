"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function toggleWatchStock(ticker: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  if (!ticker || typeof ticker !== "string") {
    return { error: "Invalid ticker" };
  }

  const upperTicker = ticker.toUpperCase();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    // Get current preferences
    const { data: prefs, error: fetchErr } = await service
      .schema("hub")
      .from("preferences")
      .select("watched_stocks")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr) return { error: fetchErr.message };

    const currentWatched = prefs?.watched_stocks || [];
    const isWatched = currentWatched.includes(upperTicker);

    // Toggle ticker in array
    const newWatched = isWatched
      ? currentWatched.filter((t: string) => t !== upperTicker)
      : [...currentWatched, upperTicker];

    // Update preferences
    const { error: updateErr } = await service
      .schema("hub")
      .from("preferences")
      .upsert({ user_id: userId, watched_stocks: newWatched }, { onConflict: "user_id" });

    if (updateErr) return { error: updateErr.message };

    revalidatePath("/investments");
    revalidatePath("/investments/stocks");
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update watchlist";
    return { error: message };
  }
}

export async function addToThesis(
  ticker: string,
  name: string,
  recommendation: string,
  summary: string,
  bullCase: string[],
  bearCase: string[],
  priceTarget12m: number
): Promise<{ error?: string; id?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    const rationale = [
      summary,
      "",
      "BULL CASE:",
      ...bullCase.map((b) => `• ${b}`),
      "",
      "BEAR CASE:",
      ...bearCase.map((b) => `• ${b}`),
      "",
      `12-month price target: $${priceTarget12m}`,
    ].join("\n");

    const { data, error } = await service
      .schema("hub")
      .from("investment_ideas")
      .insert({
        user_id: userId,
        category: "stocks",
        title: `${ticker} — ${recommendation}`,
        rationale,
        related_assets: [ticker],
        is_ai_generated: true,
        source: "claude",
        status: "researching",
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/investments");
    return { id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save thesis" };
  }
}

export interface FamilyHolding {
  ticker: string;
  quantity: number;
  marketValue: number;
  accountNames: string[];
}

export async function getFamilyHoldings(): Promise<{
  error?: string;
  holdings?: FamilyHolding[];
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    // Query user's Finance accounts (simplified - in production would be more complex)
    // For now, return empty array - full implementation would query Finance module
    // This is a placeholder for cross-module integration
    const holdings: FamilyHolding[] = [];

    return { holdings };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch family holdings";
    return { error: message };
  }
}
