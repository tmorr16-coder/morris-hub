-- E*TRADE OAuth state (request token during authorization, keyed by token not user
-- so the callback can look it up without a session)
CREATE TABLE IF NOT EXISTS hub.etrade_oauth_state (
  request_token        text PRIMARY KEY,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_token_secret text NOT NULL,
  created_at           timestamptz DEFAULT now()
);
ALTER TABLE hub.etrade_oauth_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etrade_state_own" ON hub.etrade_oauth_state
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id);
GRANT ALL ON hub.etrade_oauth_state TO authenticated, service_role;

-- E*TRADE persistent connection (access tokens, encrypted at rest via app layer)
CREATE TABLE IF NOT EXISTS hub.etrade_connections (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token         text NOT NULL,
  access_token_secret  text NOT NULL,
  account_id_key       text,          -- selected brokerage account
  account_name         text,
  connected_at         timestamptz DEFAULT now()
);
ALTER TABLE hub.etrade_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etrade_conn_own" ON hub.etrade_connections
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id);
GRANT ALL ON hub.etrade_connections TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
