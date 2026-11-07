-- Security data is server/admin only. Never expose findings to normal users.
create table hub.security_runs (
  run_id numeric(20,0) primary key,
  attempt integer not null,
  sha text not null,
  completed text[] not null,
  errors jsonb not null default '[]',
  fix_url text,
  received_at timestamptz not null default now()
);
create table hub.security_findings (
  key text primary key,
  source text not null check (source in ('dependencies','codeql')),
  title text not null,
  severity text not null check (severity in ('critical','high','medium','low')),
  location text not null,
  url text not null,
  remediation text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz
);
create index security_findings_open on hub.security_findings (severity) where resolved_at is null;
create table hub.security_mail (
  id text primary key,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  last_error text,
  attempts integer not null default 0
);
alter table hub.security_runs enable row level security;
alter table hub.security_findings enable row level security;
alter table hub.security_mail enable row level security;
revoke all on hub.security_runs, hub.security_findings, hub.security_mail from public, anon, authenticated;
grant all on hub.security_runs, hub.security_findings, hub.security_mail to service_role;

-- Serialize reports: duplicate deliveries are harmless; older runs cannot close newer findings.
create function hub.ingest_security_report(report jsonb) returns boolean
language plpgsql set search_path = '' as $$
declare latest hub.security_runs; item jsonb; rid numeric := (report->>'runId')::numeric; att integer := (report->>'attempt')::integer; sources text[];
begin
  perform pg_advisory_xact_lock(71624658);
  select * into latest from hub.security_runs order by run_id desc limit 1;
  if latest.run_id > rid or (latest.run_id = rid and latest.attempt >= att) then return false; end if;
  sources := array(select jsonb_array_elements_text(report->'completed'));
  insert into hub.security_runs (run_id,attempt,sha,completed,errors,fix_url)
  values (rid,att,report->>'sha',sources,report->'errors',report->>'fixUrl')
  on conflict (run_id) do update set attempt=excluded.attempt,completed=excluded.completed,errors=excluded.errors,fix_url=excluded.fix_url,received_at=now();
  for item in select * from jsonb_array_elements(report->'findings') loop
    insert into hub.security_findings (key,source,title,severity,location,url,remediation)
    values (item->>'key',item->>'source',item->>'title',item->>'severity',item->>'location',item->>'url',item->>'remediation')
    on conflict (key) do update set title=excluded.title,severity=excluded.severity,location=excluded.location,url=excluded.url,remediation=excluded.remediation,last_seen=now(),resolved_at=null;
  end loop;
  update hub.security_findings set resolved_at=now()
  where resolved_at is null and source=any(sources)
    and key not in (select value->>'key' from jsonb_array_elements(report->'findings'));
  return true;
end $$;
revoke all on function hub.ingest_security_report(jsonb) from public,anon,authenticated;
grant execute on function hub.ingest_security_report(jsonb) to service_role;
alter table hub.security_mail add column claimed_at timestamptz;
create function hub.claim_security_mail() returns setof hub.security_mail
language sql set search_path = '' as $$
  update hub.security_mail set claimed_at=now(),attempts=attempts+1
  where id in (select id from hub.security_mail where sent_at is null and (claimed_at is null or claimed_at < now()-interval '10 minutes') order by created_at for update skip locked limit 10)
  returning *;
$$;
revoke all on function hub.claim_security_mail() from public,anon,authenticated;
grant execute on function hub.claim_security_mail() to service_role;
