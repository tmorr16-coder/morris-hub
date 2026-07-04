import { createServiceClient } from "./supabase/server";
import { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES, DEFAULT_NEWS_SOURCES, ME_DOMAINS } from "./prefs-shared";
import type { WidgetId, NewsSource, MeDomainKey } from "./prefs-shared";
export { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES, DEFAULT_NEWS_SOURCES, ME_DOMAINS };
export type { WidgetId, NewsSource, MeDomainKey };

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
  employer_ticker?: string | null;  // e.g. "LLY" — drives Company News widget
  tts_voice?: string | null;        // e.g. "Samantha" — platform read-aloud voice name
  tts_speed?: number | null;        // 0.5–2.0, default 1.0
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
  me_domain_order: string[];
  me_domains_disabled: string[];
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
    // Interest fields are neutral by default — new users capture their own in
    // onboarding / Settings. Existing populated rows are preserved by the guards.
    if (!p.stock_tickers?.length) p.stock_tickers = [];
    if (!p.news_topics?.length) p.news_topics = [];
    if (!p.city_names?.length) p.city_names = [];
    if (!p.sports_enabled_teams?.length) p.sports_enabled_teams = [];
    if (!p.employer_ticker) p.employer_ticker = null;
    if (!p.investment_categories?.length) p.investment_categories = [
      "stocks",
      "real_estate",
      "transportation",
      "tech",
      "other",
    ];
    // app_access: grant all modules only when the array is completely empty (new user).
    // Do NOT auto-merge missing modules — child users have deliberately restricted access
    // and merging would silently re-grant Finance/Career/Investments to them.
    const ALL_MODULES = ["hub", "health", "finance", "investments", "career", "student-success", "children", "bible"];
    if (!p.app_access?.length) {
      p.app_access = ALL_MODULES;  // new adult user with no prefs yet → full access
    }
    // Previously: merged missing modules for existing users. Removed in Phase 3 because
    // it overrode child-role restrictions. Adults who need a new module can be granted
    // access via Settings → Modules rather than silently at login.
    if (!p.news_sources?.length) p.news_sources = DEFAULT_NEWS_SOURCES;
    if (!p.watched_stocks?.length) p.watched_stocks = [];
    if (!p.me_domain_order?.length) p.me_domain_order = [...ME_DOMAINS];
    if (!p.me_domains_disabled) p.me_domains_disabled = [];
    return p;
  }

  // Fallback to env defaults if no row yet
  return {
    user_id: userId,
    location_name: process.env.DEFAULT_LOCATION_NAME ?? null,
    latitude: process.env.DEFAULT_LAT ? parseFloat(process.env.DEFAULT_LAT) : null,
    longitude: process.env.DEFAULT_LON ? parseFloat(process.env.DEFAULT_LON) : null,
    stock_tickers: [],
    news_topics: [],
    city_names: process.env.DEFAULT_CITY_NAMES?.split(",") ?? [],
    sports_enabled_teams: [],
    employer_ticker: null,
    investment_categories: ["stocks", "real_estate", "transportation", "tech", "other"],
    visible_widgets: [...ALL_WIDGETS],
    reminder_categories: [...DEFAULT_REMINDER_CATEGORIES],
    app_access: ["hub", "health", "finance", "student-success", "children", "investments", "bible"],
    news_sources: DEFAULT_NEWS_SOURCES,
    watched_stocks: [],
    phone_number: null,
    sms_notifications_enabled: true,
    reminder_lead_days: 3,
    me_domain_order: [...ME_DOMAINS],
    me_domains_disabled: [],
  };
}
