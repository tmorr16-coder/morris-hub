-- Add widget visibility + custom reminder categories to hub.preferences.
-- Both are arrays so users can configure independently.

alter table hub.preferences
  add column if not exists visible_widgets  text[] default array['weather','reminders','todos','stocks','lly_news','news','tips']::text[],
  add column if not exists reminder_categories text[] default array['bill','medication','workout','appointment','personal','general']::text[];
