CREATE TABLE IF NOT EXISTS hub.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  note       text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE hub.waitlist ENABLE ROW LEVEL SECURITY;
-- Public insert only — no select for anon (service role reads for admin)
CREATE POLICY "waitlist_insert" ON hub.waitlist
  FOR INSERT WITH CHECK (true);

GRANT INSERT ON hub.waitlist TO anon, authenticated;
GRANT ALL ON hub.waitlist TO service_role;

NOTIFY pgrst, 'reload schema';
