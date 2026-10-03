-- Budgets: a monthly limit per spending category, and the alerts raised
-- against it. Alerts are keyed (budget, month, kind) so each one fires once a
-- month however many times the figures are recomputed.
CREATE TABLE IF NOT EXISTS finance.budgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The bank's primary category token (FOOD_AND_DRINK, TRANSPORTATION …), or
  -- '*' for all spending together.
  category      text NOT NULL,
  monthly_limit numeric(12,2) NOT NULL CHECK (monthly_limit > 0),
  warn_at_pct   integer NOT NULL DEFAULT 80 CHECK (warn_at_pct BETWEEN 1 AND 100),
  notify_sms    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

CREATE TABLE IF NOT EXISTS finance.budget_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id     uuid NOT NULL REFERENCES finance.budgets(id) ON DELETE CASCADE,
  month         text NOT NULL,                       -- YYYY-MM
  kind          text NOT NULL CHECK (kind IN ('warn', 'over', 'projected')),
  spent         numeric(12,2) NOT NULL,
  limit_amount  numeric(12,2) NOT NULL,
  projected     numeric(12,2),
  message       text NOT NULL,
  reminder_id   uuid,                                -- hub.reminders row, when one was raised
  sms_sent      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, month, kind)
);
CREATE INDEX IF NOT EXISTS budget_alerts_user_idx ON finance.budget_alerts(user_id, created_at DESC);

ALTER TABLE finance.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.budget_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON finance.budgets
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "own budget alerts" ON finance.budget_alerts
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id);
GRANT ALL ON finance.budgets, finance.budget_alerts TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
