create table hub.security_config (
 id boolean primary key default true check(id), version integer not null default 1,
 enabled boolean not null default true, frequency text not null default 'daily' check(frequency in ('daily','weekly')),
 time text not null default '07:17' check(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 weekday integer not null default 1 check(weekday between 0 and 6),
 next_due timestamptz default now(), last_started_run numeric(20,0), last_started_at timestamptz
);
insert into hub.security_config(id) values(true);
create table hub.security_requests (
 id uuid primary key default gen_random_uuid(), requested_by uuid references auth.users(id), requested_at timestamptz not null default now(),
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 claimed_run numeric(20,0), claimed_at timestamptz, finished_at timestamptz
);
create unique index security_request_one_queued on hub.security_requests(status) where status='queued';
alter table hub.security_config enable row level security;
alter table hub.security_requests enable row level security;
revoke all on hub.security_config,hub.security_requests from public,anon,authenticated;
grant all on hub.security_config,hub.security_requests to service_role;
create function hub.queue_security_scan(requested_by uuid) returns uuid language plpgsql set search_path='' as $$
declare queued uuid;
begin
 perform pg_advisory_xact_lock(71624659);
 select id into queued from hub.security_requests where status='queued';
 if queued is null then insert into hub.security_requests(requested_by) values(requested_by) returning id into queued; end if;
 return queued;
end $$;
create function hub.configure_security_schedule(settings jsonb, expected_version integer, due timestamptz) returns void language plpgsql set search_path='' as $$
begin
 update hub.security_config set enabled=(settings->>'enabled')::boolean,frequency=settings->>'frequency',time=settings->>'time',weekday=(settings->>'weekday')::integer,next_due=due,version=version+1
 where id and version=expected_version;
 if not found then raise exception 'Schedule changed in another session. Refresh and try again.'; end if;
end $$;
create function hub.claim_security_scan(rid numeric, event text, expected_version integer, following_due timestamptz) returns boolean language plpgsql set search_path='' as $$
declare config hub.security_config; requested boolean;
begin
 select * into config from hub.security_config where id for update;
 if config.last_started_run=rid then return true; end if;
 if config.version<>expected_version then raise exception 'Schedule changed; retry gate'; end if;
 select exists(select 1 from hub.security_requests where status='queued') into requested;
 if event not in ('push','workflow_dispatch') and not requested and not (config.enabled and config.next_due<=now()) then return false; end if;
 update hub.security_requests set status='running',claimed_run=rid,claimed_at=now() where status='queued';
 update hub.security_config set last_started_run=rid,last_started_at=now(),next_due=case when config.enabled and config.next_due<=now() then following_due else next_due end where id;
 return true;
end $$;
revoke all on function hub.queue_security_scan(uuid),hub.configure_security_schedule(jsonb,integer,timestamptz),hub.claim_security_scan(numeric,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function hub.queue_security_scan(uuid),hub.configure_security_schedule(jsonb,integer,timestamptz),hub.claim_security_scan(numeric,text,integer,timestamptz) to service_role;
-- Report completion closes the associated ad hoc request, including reports with review issues.
create function hub.finish_security_request() returns trigger language plpgsql set search_path='' as $$
begin
 update hub.security_requests set status=case when jsonb_array_length(new.errors)>0 then 'failed' else 'completed' end,finished_at=now() where claimed_run=new.run_id;
 return new;
end $$;
revoke all on function hub.finish_security_request() from public,anon,authenticated;
create trigger finish_security_request after insert or update on hub.security_runs for each row execute function hub.finish_security_request();
