-- ============================================================
-- Phase 3: Bible challenges scoped to a family circle
-- Safe to re-run (IF NOT EXISTS + DROP POLICY IF EXISTS)
-- ============================================================

ALTER TABLE bible.challenges
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'platform'
    CHECK (visibility IN ('platform', 'family'));

-- Identifies whose family circle a 'family' challenge belongs to.
-- Null for 'platform' challenges. Circle membership follows the same
-- hub.family_members(user_id, member_user_id) pattern used elsewhere.
ALTER TABLE bible.challenges
  ADD COLUMN IF NOT EXISTS circle_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "anyone reads active challenges" ON bible.challenges;
DROP POLICY IF EXISTS "read platform or own-circle challenges" ON bible.challenges;
CREATE POLICY "read platform or own-circle challenges" ON bible.challenges FOR SELECT USING (
  visibility = 'platform'
  OR circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = challenges.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
