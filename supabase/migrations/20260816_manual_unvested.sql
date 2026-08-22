-- Stock-plan "potential value": unvested/pending grant value held on an account,
-- shown alongside the vested balance so the portfolio can reflect the total.
ALTER TABLE finance.manual_accounts ADD COLUMN IF NOT EXISTS unvested_value numeric;
