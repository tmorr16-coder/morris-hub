-- ============================================================
-- Children module: managed (no-login) child profiles, age-tier
-- override, per-child activities and health notes.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- ── Managed child profiles ─────────────────────────────────────
-- Elementary-age kids realistically have no email/login. Allow a
-- family_members row to exist with no member_user_id — the parent
-- (user_id) does all data entry on the child's behalf via existing
-- display_name/birth_year columns. Account-holding members are
-- unchanged.
ALTER TABLE hub.family_members
  ALTER COLUMN member_user_id DROP NOT NULL;

ALTER TABLE hub.family_members
  DROP CONSTRAINT IF EXISTS family_members_identity_chk;
ALTER TABLE hub.family_members
  ADD CONSTRAINT family_members_identity_chk
  CHECK (member_user_id IS NOT NULL OR display_name IS NOT NULL);

-- Age-tier manual override — corrects birth-year misjudgment
-- (e.g. a mature 17-year-old already starting college). Parent-editable only.
ALTER TABLE hub.family_members
  ADD COLUMN IF NOT EXISTS life_stage_override text
    CHECK (life_stage_override IN ('elementary', 'teen', 'college'));

-- ── Child activities ───────────────────────────────────────────
-- School / sports / church / other tracking, anchored on
-- family_members.id (stable for managed AND account-holding kids).
CREATE TABLE IF NOT EXISTS hub.child_activities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES hub.family_members(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN ('school', 'sports', 'church', 'other')),
  title        text NOT NULL,
  notes        text,
  due_at       timestamptz,
  completed    boolean NOT NULL DEFAULT false,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS child_activities_child_idx ON hub.child_activities(child_id);
CREATE INDEX IF NOT EXISTS child_activities_due_idx ON hub.child_activities(due_at) WHERE completed = false;

ALTER TABLE hub.child_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent manages child activities" ON hub.child_activities;
CREATE POLICY "parent manages child activities" ON hub.child_activities
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_activities.child_id AND fm.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_activities.child_id AND fm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "self manages own activities" ON hub.child_activities;
CREATE POLICY "self manages own activities" ON hub.child_activities
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_activities.child_id AND fm.member_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_activities.child_id AND fm.member_user_id = auth.uid()
  ));

GRANT ALL ON hub.child_activities TO authenticated, service_role;

-- ── Child health notes ─────────────────────────────────────────
-- Notes for the child's next physician visit. Separate from
-- wellness_entries (strictly self-owned; a managed child has no
-- auth.users row to key that table to).
CREATE TABLE IF NOT EXISTS hub.child_health_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           uuid NOT NULL REFERENCES hub.family_members(id) ON DELETE CASCADE,
  note               text NOT NULL,
  target_visit_date  date,
  resolved           boolean NOT NULL DEFAULT false,
  created_by         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS child_health_notes_child_idx ON hub.child_health_notes(child_id);

ALTER TABLE hub.child_health_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent manages child health notes" ON hub.child_health_notes;
CREATE POLICY "parent manages child health notes" ON hub.child_health_notes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_health_notes.child_id AND fm.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_health_notes.child_id AND fm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "self manages own health notes" ON hub.child_health_notes;
CREATE POLICY "self manages own health notes" ON hub.child_health_notes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_health_notes.child_id AND fm.member_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.id = child_health_notes.child_id AND fm.member_user_id = auth.uid()
  ));

GRANT ALL ON hub.child_health_notes TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
