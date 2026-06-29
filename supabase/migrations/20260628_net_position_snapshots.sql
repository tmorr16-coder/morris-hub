-- Daily net position snapshots — drives the delta on the finance hero
CREATE TABLE IF NOT EXISTS finance.net_position_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  net_position numeric(18,2) NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE finance.net_position_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON finance.net_position_snapshots
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id);
GRANT ALL ON finance.net_position_snapshots TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
