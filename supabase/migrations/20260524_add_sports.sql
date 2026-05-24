-- Add sports team preferences to hub.preferences table
-- Allows users to track scores for their favorite teams across multiple leagues

ALTER TABLE hub.preferences
ADD COLUMN IF NOT EXISTS sports_enabled_teams TEXT[] DEFAULT '{"MLB:ATL","NFL:IND","NBA:IND","WNBA:IND","COLLEGE:FAMU-FB","COLLEGE:FAMU-BB","COLLEGE:FAMU-BK"}'::text[];

-- Comment for clarity
COMMENT ON COLUMN hub.preferences.sports_enabled_teams IS 'Array of enabled sports teams (format: LEAGUE:TEAM_CODE, e.g. "MLB:ATL", "NFL:IND")';
