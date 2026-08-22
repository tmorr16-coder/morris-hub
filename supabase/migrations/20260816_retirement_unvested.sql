-- Stock-plan "potential value" on retirement accounts: unvested/pending grant
-- value held alongside the vested balance.
ALTER TABLE finance.retirement_accounts ADD COLUMN IF NOT EXISTS unvested_value numeric;
NOTIFY pgrst, 'reload schema';
