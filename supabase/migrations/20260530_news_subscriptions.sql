-- Add news_sources column to hub.preferences for the News Subscriptions widget.
-- Each source is a JSONB object: { id, name, rss, url, auth, enabled, custom? }
ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS news_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
