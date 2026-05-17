import { createServiceClient } from "./supabase/server";

export interface Preferences {
  user_id: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  stock_tickers: string[];
  news_topics: string[];
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

  if (data) return data as Preferences;

  // Fallback to env defaults if no row yet
  return {
    user_id: userId,
    location_name: process.env.DEFAULT_LOCATION_NAME ?? "Fishers, IN",
    latitude: parseFloat(process.env.DEFAULT_LAT ?? "39.9559"),
    longitude: parseFloat(process.env.DEFAULT_LON ?? "-85.9601"),
    stock_tickers: ["LLY", "GOOGL", "AMZN", "NVDA", "MSFT"],
    news_topics: ["politics", "ai", "claude"],
  };
}
