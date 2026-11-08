-- Explicit risk-based remediation policy; existing RLS and foreign keys stay intact.
alter table hub.security_config add column automation_enabled boolean not null default true;
alter table hub.security_pr_commands add column automatic boolean not null default false;
create function hub.configure_security_automation(actor uuid, enabled boolean, run_now boolean) returns void language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(71624660);
 update hub.security_config set automation_enabled=enabled,version=version+1 where id;
 if not enabled then
  update hub.security_pr_commands set status='blocked',finished_at=now(),message='Automation paused by administrator.' where automatic and status='queued';
 end if;
 if run_now then perform hub.queue_security_repair(actor,null); end if;
end $$;
create function hub.queue_security_automatic_merge(pull_number integer,head_sha text,base_sha text) returns uuid language plpgsql set search_path='' as $$
declare item hub.security_pulls; queued uuid;
begin
 perform pg_advisory_xact_lock(71624660);
 if not exists(select 1 from hub.security_config where id and automation_enabled) then return null; end if;
 select * into item from hub.security_pulls where number=pull_number;
 if not found or item.synced_at<now()-interval '15 minutes' or item.snapshot->>'state'<>'open' or item.snapshot->>'draft'<>'false' or item.snapshot->>'head'<>head_sha or item.snapshot->>'base'<>base_sha or item.snapshot#>>'{risk,level}' is distinct from 'low' or item.snapshot#>>'{risk,version}' is distinct from '1' then return null; end if;
 -- Serialize automatic merges so changes to main do not invalidate sibling plans.
 if exists(select 1 from hub.security_pr_commands where kind='merge' and status in ('queued','running')) then return null; end if;
 -- Failed validation is a human decision, not an unbounded automatic retry loop.
 if exists(select 1 from hub.security_pr_commands where kind='merge' and pr_number=pull_number and expected_head=head_sha and status='blocked' and message not in ('Automation paused by administrator.','Main changed. Refresh the review before merging.')) then return null; end if;
 insert into hub.security_pr_commands(kind,pr_number,expected_head,expected_base,automatic) values('merge',pull_number,head_sha,base_sha,true) returning id into queued;
 return queued;
end $$;
create function hub.authorize_security_automatic_merge(command_id uuid,rid numeric) returns boolean language sql set search_path='' as $$
 select exists(select 1 from hub.security_pr_commands c join hub.security_config s on s.id where c.id=command_id and c.automatic and c.status='running' and c.claimed_run=rid and s.automation_enabled);
$$;
revoke all on function hub.configure_security_automation(uuid,boolean,boolean),hub.queue_security_automatic_merge(integer,text,text),hub.authorize_security_automatic_merge(uuid,numeric) from public,anon,authenticated;
grant execute on function hub.configure_security_automation(uuid,boolean,boolean),hub.queue_security_automatic_merge(integer,text,text),hub.authorize_security_automatic_merge(uuid,numeric) to service_role;
