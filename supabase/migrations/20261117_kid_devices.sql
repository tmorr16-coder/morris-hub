-- A child's own iPad: paired once by a parent, unlocked by the child with a
-- four-digit PIN.
--
-- The PIN alone is never enough. It only works on a device that holds a
-- pairing token, and the token is only issued against a short-lived code a
-- signed-in parent created. So a stranger with the link sees a "set up this
-- iPad" screen, not a keypad, and guessing four digits needs the iPad itself
-- (and is slowed by a lockout recorded here).
--
-- Both tables are read and written only by the server with the service role.
-- RLS is on with no policies, so nothing reaches them from a browser.

create table if not exists hub.child_kid_pins (
  child_id    uuid primary key references hub.family_members(id) on delete cascade,
  pin_hash    text not null,                 -- scrypt$<salt>$<hash>, never the digits
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists hub.child_devices (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references hub.family_members(id) on delete cascade,
  label            text not null default 'iPad',
  created_by       uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  -- Pairing: a one-time code, stored hashed, valid for minutes.
  pair_code_hash   text unique,
  pair_expires_at  timestamptz,
  -- After pairing: the device's long-lived token, stored hashed.
  token_hash       text unique,
  paired_at        timestamptz,
  last_seen_at     timestamptz,
  -- PIN state: how long the child stays signed in, and the guessing lockout.
  unlocked_until   timestamptz,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  revoked_at       timestamptz
);
create index if not exists child_devices_child_idx on hub.child_devices (child_id);

alter table hub.child_kid_pins enable row level security;
alter table hub.child_devices  enable row level security;
