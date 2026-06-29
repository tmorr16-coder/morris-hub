-- Add visible_to_family flag to manual_accounts
-- When true, this account's balance is visible to all platform members on the finance dashboard.
ALTER TABLE finance.manual_accounts
  ADD COLUMN IF NOT EXISTS visible_to_family boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_manual_accounts_visible
  ON finance.manual_accounts (visible_to_family)
  WHERE visible_to_family = true;

NOTIFY pgrst, 'reload schema';
