-- ============================================================
-- Phase 2b completion: parent view of child data + birth year
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ============================================================

-- ── Birth year on family members ──────────────────────────────────
-- Stored on the invitation so it travels with the member record.
ALTER TABLE hub.family_invitations
  ADD COLUMN IF NOT EXISTS birth_year INT;

ALTER TABLE hub.family_members
  ADD COLUMN IF NOT EXISTS birth_year INT;

-- ── Parent read access: student_support ───────────────────────────
-- Allow parents to see their child's active courses and upcoming
-- assignments. Child = family_member with role='child'.
-- Uses service_role in the API for explicit app-level auth check,
-- but policies guard the direct Supabase access path too.

ALTER TABLE student_support.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own courses"      ON student_support.courses;
DROP POLICY IF EXISTS "parents read child courses"  ON student_support.courses;
CREATE POLICY "users read own courses" ON student_support.courses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "parents read child courses" ON student_support.courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hub.family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.member_user_id = user_id
        AND fm.role = 'child'
    )
  );

ALTER TABLE student_support.course_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own assignments"     ON student_support.course_reminders;
DROP POLICY IF EXISTS "parents read child assignments" ON student_support.course_reminders;
CREATE POLICY "users read own assignments" ON student_support.course_reminders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "parents read child assignments" ON student_support.course_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hub.family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.member_user_id = user_id
        AND fm.role = 'child'
    )
  );

-- Grade visibility is opt-in: share_grades flag on course_shares controls it
-- Parents can always see course names + deadlines; grades require explicit share.

NOTIFY pgrst, 'reload schema';
