-- ── Family Circle (hub level) ────────────────────────────────────────────────
-- Defines who is in a user's family/community circle.
-- Both directions must be added explicitly (Terry adds Alicia; Alicia adds Terry).

CREATE TABLE IF NOT EXISTS hub.family_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname       text,                              -- optional display name override
  created_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, member_user_id),
  CHECK (user_id <> member_user_id)
);

ALTER TABLE hub.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_members_select" ON hub.family_members
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "family_members_insert" ON hub.family_members
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "family_members_delete" ON hub.family_members
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

GRANT ALL ON hub.family_members TO authenticated, service_role;

-- ── Manual Account Shares (finance level) ────────────────────────────────────
-- Per-person sharing for manually imported/entered accounts.
-- Replaces the blunt visible_to_family boolean.

CREATE TABLE IF NOT EXISTS finance.manual_account_shares (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES finance.manual_accounts(id) ON DELETE CASCADE,
  owner_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode             text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
  accepted         boolean NOT NULL DEFAULT true,  -- false = pending (manual mode)
  created_at       timestamptz DEFAULT now(),
  UNIQUE(account_id, recipient_user_id)
);

ALTER TABLE finance.manual_account_shares ENABLE ROW LEVEL SECURITY;

-- Owner can fully manage shares they created
CREATE POLICY "manual_shares_owner" ON finance.manual_account_shares
  FOR ALL TO authenticated USING ((select auth.uid()) = owner_user_id);

-- Recipient can see (and accept) shares directed to them
CREATE POLICY "manual_shares_recipient_select" ON finance.manual_account_shares
  FOR SELECT TO authenticated USING ((select auth.uid()) = recipient_user_id);
CREATE POLICY "manual_shares_recipient_update" ON finance.manual_account_shares
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = recipient_user_id)
  WITH CHECK ((select auth.uid()) = recipient_user_id);

GRANT ALL ON finance.manual_account_shares TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
