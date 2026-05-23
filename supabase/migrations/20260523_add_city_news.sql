-- Add city news preferences to hub.preferences table
-- Allows users to get local news from their selected cities

ALTER TABLE hub.preferences
ADD COLUMN IF NOT EXISTS city_names TEXT[] DEFAULT '{}'::text[];

-- Comment for clarity
COMMENT ON COLUMN hub.preferences.city_names IS 'Array of city names for local news (e.g., ["Indianapolis, IN", "Tallahassee, FL"])';
