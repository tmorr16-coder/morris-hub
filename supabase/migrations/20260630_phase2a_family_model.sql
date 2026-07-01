-- ============================================================
-- Phase 2a: Household identity and permissions
-- Safe to re-run (IF NOT EXISTS + DROP POLICY IF EXISTS)
-- ============================================================

-- ── Family members: add role column if missing ────────────────
ALTER TABLE hub.family_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'adult'
    CHECK (role IN ('adult', 'child'));

ALTER TABLE hub.family_members
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ── Family invitations ────────────────────────────────────────
-- One row per invite. Accepting auto-creates hub.family_members entries.
CREATE TABLE IF NOT EXISTS hub.family_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email TEXT NOT NULL,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'adult' CHECK (role IN ('adult', 'child')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(inviter_id, invite_email)
);

ALTER TABLE hub.family_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inviters manage own invites"   ON hub.family_invitations;
DROP POLICY IF EXISTS "invitees see pending invites"  ON hub.family_invitations;
DROP POLICY IF EXISTS "invitees respond to invites"   ON hub.family_invitations;

-- Inviter can see and delete their own outgoing invites
CREATE POLICY "inviters manage own invites" ON hub.family_invitations
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);

-- Invitee can see invites addressed to their email
CREATE POLICY "invitees see pending invites" ON hub.family_invitations
  FOR SELECT USING (
    invite_email = (
      SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1
    )
  );

-- Invitee can update status (accept/decline) on invites addressed to them
CREATE POLICY "invitees respond to invites" ON hub.family_invitations
  FOR UPDATE USING (
    invite_email = (
      SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1
    )
  );

GRANT ALL ON hub.family_invitations TO authenticated, service_role;

-- ── Household tasks: assigned_to on reminders ─────────────────
-- Allows reminders to be assigned to a family member
ALTER TABLE hub.reminders
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE hub.reminders
  ADD COLUMN IF NOT EXISTS is_household BOOLEAN NOT NULL DEFAULT FALSE;

-- RLS: let assigned users see reminders assigned to them
DROP POLICY IF EXISTS "assigned users read reminders" ON hub.reminders;
CREATE POLICY "assigned users read reminders" ON hub.reminders
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = assigned_to
  );

-- ── Update family_members RLS to include role access ─────────────
-- Allow members to see the family circle they belong to (for /home/family page)
DROP POLICY IF EXISTS "members see circles they joined" ON hub.family_members;
CREATE POLICY "members see circles they joined" ON hub.family_members
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = member_user_id
  );

NOTIFY pgrst, 'reload schema';
