import { createServiceClient } from "./supabase/server";
import { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES, DEFAULT_NEWS_SOURCES } from "./prefs-shared";
import type { WidgetId, NewsSource } from "./prefs-shared";
export { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES, DEFAULT_NEWS_SOURCES };
export type { WidgetId, NewsSource };

export interface Preferences {
  user_id: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  stock_tickers: string[];
  news_topics: string[];
  city_names: string[];
  sports_enabled_teams: string[];
  investment_categories: string[];
  visible_widgets: WidgetId[];
  reminder_categories: string[];
  app_access: string[];
  news_sources: NewsSource[];
  watched_stocks: string[];
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
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
    if (!p.city_names?.length) p.city_names = [
      "Indianapolis, IN",
      "Fishers, IN",
      "Tallahassee, FL",
      "Perry, FL",
    ];
    if (!p.sports_enabled_teams?.length) p.sports_enabled_teams = [
      "MLB:ATL",
      "NFL:IND",
      "NBA:IND",
      "WNBA:IND",
      "COLLEGE:FAMU-FB",
      "COLLEGE:FAMU-BB",
      "COLLEGE:FAMU-BK",
    ];
    if (!p.investment_categories?.length) p.investment_categories = [
      "stocks",
      "real_estate",
      "transportation",
      "tech",
      "other",
    ];
    if (!p.app_access?.length) p.app_access = ["hub", "health", "finance", "student-success", "investments", "bible"];
    if (!p.news_sources?.length) p.news_sources = DEFAULT_NEWS_SOURCES;
    if (!p.watched_stocks?.length) p.watched_stocks = [];
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
    sports_enabled_teams: [
      "MLB:ATL",
      "NFL:IND",
      "NBA:IND",
      "WNBA:IND",
      "COLLEGE:FAMU-FB",
      "COLLEGE:FAMU-BB",
      "COLLEGE:FAMU-BK",
    ],
    investment_categories: ["stocks", "real_estate", "transportation", "tech", "other"],
    visible_widgets: [...ALL_WIDGETS],
    reminder_categories: [...DEFAULT_REMINDER_CATEGORIES],
    app_access: ["hub", "health", "finance", "student-success", "investments", "bible"],
    news_sources: DEFAULT_NEWS_SOURCES,
    watched_stocks: [],
    phone_number: null,
    sms_notifications_enabled: true,
    reminder_lead_days: 3,
  };
}
