ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS persona text CHECK (persona IN ('parent', 'student', 'individual')),
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name text;

NOTIFY pgrst, 'reload schema';
