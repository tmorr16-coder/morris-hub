-- Polling must also detect an unreviewed main SHA if a pending push run was coalesced.
drop function hub.claim_security_scan(numeric,text,integer,timestamptz);
create function hub.claim_security_scan(rid numeric,event text,expected_version integer,following_due timestamptz,head_sha text) returns boolean language plpgsql set search_path='' as $$
declare config hub.security_config; requested boolean; reviewed_sha text;
begin
 select * into config from hub.security_config where id for update;
 update hub.security_requests set status='failed',finished_at=now() where status='running' and claimed_at<now()-interval '2 hours';
 if config.last_started_run=rid then return true; end if;
 if config.version<>expected_version then raise exception 'Schedule changed; retry gate'; end if;
 select exists(select 1 from hub.security_requests where status='queued') into requested;
 select sha into reviewed_sha from hub.security_runs order by run_id desc limit 1;
 if event not in ('push','workflow_dispatch') and not requested and not (config.enabled and config.next_due<=now()) and reviewed_sha=head_sha then return false; end if;
 update hub.security_requests set status='running',claimed_run=rid,claimed_at=now() where status='queued';
 update hub.security_config set last_started_run=rid,last_started_at=now(),next_due=case when config.enabled and config.next_due<=now() then following_due else next_due end where id;
 return true;
end $$;
revoke all on function hub.claim_security_scan(numeric,text,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function hub.claim_security_scan(numeric,text,integer,timestamptz,text) to service_role;
