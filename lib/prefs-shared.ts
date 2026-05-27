// Widget + reminder-category constants that are safe to import from both
// server components and client components. No server-only imports here.

export const ALL_WIDGETS = [
  "health", "weather", "reminders", "todos", "stocks", "sports", "lly_news", "news", "city_news", "student-support", "tips",
] as const;

export type WidgetId = typeof ALL_WIDGETS[number];

export const DEFAULT_REMINDER_CATEGORIES = [
  "bill", "medication", "workout", "appointment", "personal", "general",
];
