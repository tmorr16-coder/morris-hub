-- Add watched_stocks column to hub.preferences for stock research watchlist
ALTER TABLE hub.preferences
ADD COLUMN IF NOT EXISTS watched_stocks TEXT[] DEFAULT '{}'::text[];

-- Create index for efficient filtering (optional - can help if user has many watched stocks)
CREATE INDEX IF NOT EXISTS idx_preferences_watched_stocks ON hub.preferences USING GIN (watched_stocks);
