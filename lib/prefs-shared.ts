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

export const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  {
    id: "atlantic",
    name: "The Atlantic",
    rss: "https://www.theatlantic.com/feed/all/",
    url: "https://www.theatlantic.com",
    authUrl: "https://accounts.theatlantic.com/accounts/login/?next=%2F&method=google-oauth2",
    auth: "google",
    enabled: true,
  },
  {
    id: "nytimes",
    name: "New York Times",
    rss: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    url: "https://nytimes.com",
    authUrl: "https://myaccount.nytimes.com/auth/login",
    auth: "google",
    enabled: true,
  },
  {
    // Topic or publication feed — set in Settings.
    // medium.com/feed/tag/[topic]  or  medium.com/feed/[publication-slug]
    id: "medium",
    name: "Medium",
    rss: "https://medium.com/feed/tag/technology",
    url: "https://medium.com",
    authUrl: "https://medium.com/m/account/authenticate-google",
    auth: "google",
    enabled: true,
  },
  {
    id: "wapo",
    name: "Washington Post",
    rss: "https://feeds.washingtonpost.com/rss/world",
    url: "https://washingtonpost.com",
    authUrl: "https://account.washingtonpost.com/login-form?dest=%2F",
    auth: "google",
    enabled: false,
  },
];
