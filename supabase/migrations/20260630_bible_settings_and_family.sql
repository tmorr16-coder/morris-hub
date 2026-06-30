-- ── User Preferences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bible.user_preferences (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_bible_id TEXT NOT NULL DEFAULT 'de4e12af7f28f599-02',  -- KJV
  reminder_time      TIME,           -- e.g. '07:00:00' — daily reading reminder
  font_size          TEXT NOT NULL DEFAULT 'md' CHECK (font_size IN ('sm','md','lg','xl')),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE bible.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own prefs" ON bible.user_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT ALL ON bible.user_preferences TO authenticated, service_role;

-- ── Family Reading Plans ──────────────────────────────────────────────────────
-- A shared plan any family member can join and track together.
CREATE TABLE IF NOT EXISTS bible.family_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES bible.reading_plans(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE bible.family_plans ENABLE ROW LEVEL SECURITY;
-- All authenticated users can read family plans (family circle enforced in app)
CREATE POLICY "read family plans" ON bible.family_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert family plans" ON bible.family_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "delete family plans" ON bible.family_plans FOR DELETE USING (auth.uid() = created_by);
GRANT ALL ON bible.family_plans TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS bible.family_plan_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_plan_id UUID NOT NULL REFERENCES bible.family_plans(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_plan_id, user_id)
);
ALTER TABLE bible.family_plan_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON bible.family_plan_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members join" ON bible.family_plan_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members leave" ON bible.family_plan_members FOR DELETE USING (auth.uid() = user_id);
GRANT ALL ON bible.family_plan_members TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS bible.family_plan_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_plan_id UUID NOT NULL REFERENCES bible.family_plans(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number     INT NOT NULL,
  reading_ref    TEXT NOT NULL,
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_plan_id, user_id, day_number, reading_ref)
);
ALTER TABLE bible.family_plan_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress read" ON bible.family_plan_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "progress insert" ON bible.family_plan_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT ALL ON bible.family_plan_progress TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
