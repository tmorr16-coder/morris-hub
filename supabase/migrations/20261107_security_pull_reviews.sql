create table hub.security_pulls (
 number integer primary key check(number>0),
 snapshot jsonb not null,
 synced_at timestamptz not null default now(),
 reported_run numeric(20,0) not null default 0
);
create table hub.security_pr_commands (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('refresh','merge')),
 pr_number integer references hub.security_pulls(number),
 expected_head text, expected_base text,
 requested_by uuid references auth.users(id), requested_at timestamptz not null default now(),
 status text not null default 'queued' check(status in ('queued','running','merged','completed','blocked')),
 claimed_run numeric(20,0), claimed_at timestamptz, finished_at timestamptz,
 message text not null default ''
);
create unique index security_pr_one_merge on hub.security_pr_commands(pr_number) where kind='merge' and status in ('queued','running');
create unique index security_pr_one_refresh on hub.security_pr_commands(kind) where kind='refresh' and status in ('queued','running');
alter table hub.security_pulls enable row level security;
alter table hub.security_pr_commands enable row level security;
revoke all on hub.security_pulls,hub.security_pr_commands from public,anon,authenticated;
grant all on hub.security_pulls,hub.security_pr_commands to service_role;
create function hub.queue_security_pr_command(actor uuid, pull_number integer default null, head_sha text default null, base_sha text default null) returns uuid language plpgsql set search_path='' as $$
declare item hub.security_pulls; queued uuid;
begin
 perform pg_advisory_xact_lock(71624660);
 if pull_number is null then
  select id into queued from hub.security_pr_commands where kind='refresh' and status in ('queued','running');
  if queued is null then insert into hub.security_pr_commands(kind,requested_by) values('refresh',actor) returning id into queued; end if;
 else
  select * into item from hub.security_pulls where number=pull_number;
  if not found or item.synced_at<now()-interval '15 minutes' then raise exception 'Refresh PR details before merging'; end if;
  if item.snapshot->>'state'<>'open' or (item.snapshot->>'draft')::boolean or item.snapshot->>'head'<>head_sha or item.snapshot->>'base'<>base_sha then raise exception 'PR changed or is not open for merge. Refresh and review again'; end if;
  select id into queued from hub.security_pr_commands where pr_number=pull_number and kind='merge' and status in ('queued','running');
  if queued is null then insert into hub.security_pr_commands(kind,pr_number,expected_head,expected_base,requested_by) values('merge',pull_number,head_sha,base_sha,actor) returning id into queued; end if;
 end if;
 return queued;
end $$;
create function hub.claim_security_pr_commands(rid numeric) returns setof hub.security_pr_commands language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(71624660);
 update hub.security_pr_commands set status='blocked',message='Worker did not finish. Refresh and retry.',finished_at=now() where status='running' and claimed_at<now()-interval '2 hours';
 update hub.security_pr_commands set status='running',claimed_run=rid,claimed_at=now() where status='queued';
 return query select * from hub.security_pr_commands where claimed_run=rid and status='running';
end $$;
create function hub.record_security_pulls(rid numeric, pulls jsonb, results jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb;
begin
 for item in select * from jsonb_array_elements(pulls) loop
  insert into hub.security_pulls(number,snapshot,reported_run) values((item->>'number')::integer,item,rid)
  on conflict(number) do update set snapshot=excluded.snapshot,synced_at=now(),reported_run=excluded.reported_run where hub.security_pulls.reported_run<=rid and (hub.security_pulls.snapshot->>'state'<>'merged' or excluded.snapshot->>'state'='merged') and (excluded.snapshot->>'updatedAt')::timestamptz >= (hub.security_pulls.snapshot->>'updatedAt')::timestamptz;
 end loop;
 for item in select * from jsonb_array_elements(results) loop
  update hub.security_pr_commands set status=item->>'status',message=item->>'message',finished_at=now()
  where id=(item->>'id')::uuid and claimed_run=rid and status='running';
 end loop;
 update hub.security_pr_commands set status='completed',message='PR details refreshed',finished_at=now() where claimed_run=rid and kind='refresh' and status='running';
end $$;
revoke all on function hub.queue_security_pr_command(uuid,integer,text,text),hub.claim_security_pr_commands(numeric),hub.record_security_pulls(numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function hub.queue_security_pr_command(uuid,integer,text,text),hub.claim_security_pr_commands(numeric),hub.record_security_pulls(numeric,jsonb,jsonb) to service_role;
