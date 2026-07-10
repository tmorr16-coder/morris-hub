-- Per-user Alpaca brokerage credentials.
--
-- ⚠️  APPLY THIS MANUALLY — it is not run automatically. Paste it into the
-- Supabase SQL editor (or run via the migration tooling) before the per-user
-- Alpaca connect flow will work. Until then the app tolerates the missing table
-- and treats every non-owner user as "not connected" (see lib/alpaca.ts).
--
-- Mirrors the per-user token tables (oura_tokens) and the etrade_connections
-- credential table: own-row RLS keyed by user_id, secrets written server-side
-- via the service role.

CREATE TABLE IF NOT EXISTS public.alpaca_credentials (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key     text NOT NULL,
  api_secret  text NOT NULL,
  is_paper    boolean NOT NULL DEFAULT true,   -- paper vs live trading
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.alpaca_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alpaca_creds_own" ON public.alpaca_credentials
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id);

GRANT ALL ON public.alpaca_credentials TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
