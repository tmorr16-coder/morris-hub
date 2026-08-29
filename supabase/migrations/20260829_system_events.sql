-- One place every subsystem writes its failures, so nobody has to check by hand.
--
-- Until now a failure went wherever its author happened to send it. SimpleFIN
-- sync writes plaid_items.last_error (recent, and only the latest one). Oura and
-- Withings write console.error and nothing else, so a token that expired weeks
-- ago is invisible unless someone opens Vercel's logs. The crons report nothing
-- at all. The result was a platform where "what is currently broken?" could only
-- be answered by opening each integration in turn and inferring from stale data.
--
-- usage_logs is deliberately not reused: it is an analytics table with token
-- counts, no severity, no subject to group by, and no notion of a problem being
-- resolved. Those three are the whole point here.
--
-- Rows are written on failure and closed on the next success, so "unresolved"
-- means "still broken right now" rather than "failed at some point".

create table if not exists hub.system_events (
  id           uuid primary key default gen_random_uuid(),
  -- Null for platform-wide work (crons) that belongs to no single person.
  user_id      uuid references auth.users(id) on delete cascade,
  source       text not null,          -- simplefin | oura | withings | cron | ...
  subject      text,                   -- the item/integration this concerns
  severity     text not null default 'error',   -- error | warning
  message      text not null,
  detail       jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  -- Set when the same source+subject next succeeds. Null means still failing.
  resolved_at  timestamptz
);

comment on table hub.system_events is
  'Cross-platform failure log. Written on failure, closed on the next success. Never contains credentials — messages come from our own throw sites.';

-- The page''s main query: everything unresolved, newest first.
create index if not exists system_events_open_idx
  on hub.system_events(occurred_at desc)
  where resolved_at is null;

-- Closing a run of failures for one integration.
create index if not exists system_events_subject_idx
  on hub.system_events(source, subject)
  where resolved_at is null;

alter table hub.system_events enable row level security;

-- Read-only to the owner; everything is written by the service role from
-- server-side sync paths, and the admin page reads through the service client.
create policy "system_events: read own" on hub.system_events
  for select using (auth.uid() = user_id);

grant usage on schema hub to authenticated, service_role;
grant select on hub.system_events to authenticated;
grant select, insert, update, delete on hub.system_events to service_role;
