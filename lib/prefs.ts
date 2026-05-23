import { createServiceClient } from "./supabase/server";
import { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES } from "./prefs-shared";
import type { WidgetId } from "./prefs-shared";
export { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES };
export type { WidgetId };

export interface Preferences {
  user_id: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  stock_tickers: string[];
  news_topics: string[];
  city_names: string[];
  visible_widgets: WidgetId[];
  reminder_categories: string[];
}

export async function getPreferences(userId: string): Promise<Preferences> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("hub")
    .from("preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    const p = data as Preferences;
    // New columns default to NULL for existing rows — fall back to defaults.
    if (!p.visible_widgets?.length) p.visible_widgets = [...ALL_WIDGETS];
    if (!p.reminder_categories?.length) p.reminder_categories = [...DEFAULT_REMINDER_CATEGORIES];
    return p;
  }

  // Fallback to env defaults if no row yet
  return {
    user_id: userId,
    location_name: process.env.DEFAULT_LOCATION_NAME ?? "Fishers, IN",
    latitude: parseFloat(process.env.DEFAULT_LAT ?? "39.9559"),
    longitude: parseFloat(process.env.DEFAULT_LON ?? "-85.9601"),
    stock_tickers: ["LLY", "GOOGL", "AMZN", "NVDA", "MSFT"],
    news_topics: ["politics", "ai", "claude"],
    city_names: process.env.DEFAULT_CITY_NAMES?.split(",") ?? [
      "Indianapolis, IN",
      "Fishers, IN",
      "Tallahassee, FL",
      "Perry, FL",
    ],
    visible_widgets: [...ALL_WIDGETS],
    reminder_categories: [...DEFAULT_REMINDER_CATEGORIES],
  };
}
