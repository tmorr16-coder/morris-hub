-- LinkedIn OAuth columns on career_profile
ALTER TABLE career.career_profile
  ADD COLUMN IF NOT EXISTS linkedin_connected       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkedin_connected_at    timestamptz,
  ADD COLUMN IF NOT EXISTS linkedin_name            text,
  ADD COLUMN IF NOT EXISTS linkedin_picture_url     text,
  ADD COLUMN IF NOT EXISTS linkedin_email           text;

NOTIFY pgrst, 'reload schema';
