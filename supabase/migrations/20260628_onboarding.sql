ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS persona text CHECK (persona IN ('parent', 'student', 'individual')),
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name text;

NOTIFY pgrst, 'reload schema';
ALTER TABLE hub.preferences ADD COLUMN IF NOT EXISTS employer_ticker text;
ALTER TABLE hub.preferences ADD COLUMN IF NOT EXISTS tts_voice text; ALTER TABLE hub.preferences ADD COLUMN IF NOT EXISTS tts_speed numeric(3,1) DEFAULT 1.0; NOTIFY pgrst, 'reload schema';
