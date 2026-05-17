-- Cross-platform reminders. Each row can be created by any app
-- (hub / finance / health) and shown wherever — the source_app and
-- category fields disambiguate.

CREATE TABLE IF NOT EXISTS hub.reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               text NOT NULL,
  notes               text,
  due_at              timestamptz NOT NULL,
  recurrence          text NOT NULL DEFAULT 'once'
                      CHECK (recurrence IN ('once','daily','weekly','biweekly','monthly','quarterly','yearly')),
  category            text NOT NULL DEFAULT 'general',
  source_app          text NOT NULL DEFAULT 'hub',
  completed_at        timestamptz,
  last_triggered_at   timestamptz,
  snooze_until        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_user_due_idx
  ON hub.reminders(user_id, due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS reminders_source_app_idx
  ON hub.reminders(source_app, user_id);

ALTER TABLE hub.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders: read own"   ON hub.reminders;
DROP POLICY IF EXISTS "reminders: insert own" ON hub.reminders;
DROP POLICY IF EXISTS "reminders: update own" ON hub.reminders;
DROP POLICY IF EXISTS "reminders: delete own" ON hub.reminders;

CREATE POLICY "reminders: read own"   ON hub.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminders: insert own" ON hub.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders: update own" ON hub.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reminders: delete own" ON hub.reminders FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON hub.reminders TO authenticated;
GRANT ALL ON hub.reminders TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_reminders ON hub.reminders;
CREATE TRIGGER set_updated_at_reminders BEFORE UPDATE ON hub.reminders
  FOR EACH ROW EXECUTE FUNCTION hub.set_updated_at();
