-- ============================================================
-- Phones that push Apple Health data on their own.
--
-- Health Auto Export authenticates with one shared secret and a user id in
-- the URL. A native app deserves better: each phone is paired once with a
-- short one-time code shown to a signed-in user, receives its own token, and
-- can be revoked without touching anyone else's. Only hashes are stored.
-- ============================================================
create table if not exists public.health_devices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  label               text,
  pairing_code_hash   text,                 -- set while waiting to be paired
  pairing_expires_at  timestamptz,
  token_hash          text unique,          -- set once paired
  paired_at           timestamptz,
  last_seen_at        timestamptz,
  last_result         jsonb,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists health_devices_user_idx on public.health_devices(user_id);
create index if not exists health_devices_code_idx on public.health_devices(pairing_code_hash) where pairing_code_hash is not null;

alter table public.health_devices enable row level security;
drop policy if exists "users read own health devices" on public.health_devices;
create policy "users read own health devices" on public.health_devices
  for select using (auth.uid() = user_id);
-- Writes go through the service role only: pairing and token checks happen
-- server-side, and a client must never be able to mint its own token.
grant select on public.health_devices to authenticated;
grant all on public.health_devices to service_role;

notify pgrst, 'reload schema';
