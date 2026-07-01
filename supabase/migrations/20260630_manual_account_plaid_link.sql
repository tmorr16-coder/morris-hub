-- Link a manual account to its Plaid counterpart to prevent double-counting
-- in the net position calculation. When plaid_account_id is set, the
-- Finance Dashboard excludes that manual account from manualTotal since
-- the Plaid account is already included in the Plaid accounts sum.
ALTER TABLE finance.manual_accounts
  ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;
