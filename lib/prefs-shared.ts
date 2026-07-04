// Widget + reminder-category constants that are safe to import from both
// server components and client components. No server-only imports here.

export const ALL_WIDGETS = [
  "health", "weather", "reminders", "todos", "stocks", "sports", "lly_news", "news", "city_news", "news_subscriptions", "tips", "career",
] as const;

export type WidgetId = typeof ALL_WIDGETS[number];

export const DEFAULT_REMINDER_CATEGORIES = [
  "bill", "medication", "workout", "appointment", "personal", "general",
];

export const ME_DOMAINS = ["career", "health", "mind", "spirit", "courses"] as const;

export type MeDomainKey = typeof ME_DOMAINS[number];

// ── News subscription sources (client-safe — no server imports) ───────────────
export interface NewsSource {
  id: string;
  name: string;
  rss: string;
  url: string;
  authUrl?: string;
  auth: "google" | "email" | "direct";
  enabled: boolean;
  custom?: boolean;
}

// Default subscription: Associated Press — free, no login required. Users can
// add their own publications (incl. paywalled ones) in Settings → News subscriptions.
export const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  {
    id: "ap",
    name: "Associated Press",
    rss: "https://feedx.net/rss/ap.xml",
    url: "https://apnews.com",
    auth: "direct",
    enabled: true,
  },
];
