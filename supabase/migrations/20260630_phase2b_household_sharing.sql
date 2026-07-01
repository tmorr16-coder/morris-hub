-- ============================================================
-- Phase 2b: Household data sharing across family circle
-- Run AFTER 20260630_phase2a_family_model.sql
-- Safe to re-run (DROP POLICY IF EXISTS pattern)
-- ============================================================

-- ── Extend reminder visibility to include family household tasks ──
-- Phase 2a only allowed "assigned_to = auth.uid()" visibility.
-- Phase 2b adds: family circle members can see IS_HOUSEHOLD reminders
-- from each other, enabling shared household task boards.

DROP POLICY IF EXISTS "assigned users read reminders"      ON hub.reminders;
DROP POLICY IF EXISTS "users and family read reminders"    ON hub.reminders;

CREATE POLICY "users and family read reminders" ON hub.reminders
  FOR SELECT USING (
    -- Own reminders (always)
    auth.uid() = user_id
    -- Reminders explicitly assigned to you by another user
    OR auth.uid() = assigned_to
    -- Household reminders from family circle members
    OR (
      is_household = true
      AND auth.uid() IN (
        SELECT fm.user_id FROM hub.family_members fm
        WHERE fm.member_user_id = user_id
          AND fm.user_id = auth.uid()
      )
    )
  );

-- Assigned users can also complete reminders assigned to them
DROP POLICY IF EXISTS "assigned users update reminders" ON hub.reminders;
CREATE POLICY "assigned users update reminders" ON hub.reminders
  FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = assigned_to
  );

-- ── Extend hub.todos with is_household and assigned_to ─────────────
-- Personal todos can become household tasks too
ALTER TABLE hub.todos
  ADD COLUMN IF NOT EXISTS assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE hub.todos
  ADD COLUMN IF NOT EXISTS is_household BOOLEAN NOT NULL DEFAULT FALSE;

-- Family members can see household todos from their circle
DROP POLICY IF EXISTS "users read own todos"              ON hub.todos;
DROP POLICY IF EXISTS "users and family read todos"       ON hub.todos;

-- Create comprehensive read policy (merging own + assigned + household)
CREATE POLICY "users and family read todos" ON hub.todos
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = assigned_to
    OR (
      is_household = true
      AND auth.uid() IN (
        SELECT fm.user_id FROM hub.family_members fm
        WHERE fm.member_user_id = user_id
          AND fm.user_id = auth.uid()
      )
    )
  );

-- Keep write restricted to owner
DROP POLICY IF EXISTS "users insert own todos"  ON hub.todos;
DROP POLICY IF EXISTS "users update own todos"  ON hub.todos;
DROP POLICY IF EXISTS "users delete own todos"  ON hub.todos;
CREATE POLICY "users insert own todos"  ON hub.todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own todos"  ON hub.todos FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = assigned_to);
CREATE POLICY "users delete own todos"  ON hub.todos FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
