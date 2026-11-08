-- Match the scan claim order (enqueue lock, PR lock, config row) to avoid a settings/scan deadlock.
create or replace function hub.configure_security_automation(actor uuid, enabled boolean, run_now boolean) returns void language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(71624659);
 perform pg_advisory_xact_lock(71624660);
 update hub.security_config set automation_enabled=configure_security_automation.enabled,version=version+1 where id;
 if not enabled then
  update hub.security_pr_commands set status='blocked',finished_at=now(),message='Automation paused by administrator.' where automatic and status='queued';
 end if;
 if run_now then perform hub.queue_security_repair(actor,null); end if;
end $$;
revoke all on function hub.configure_security_automation(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function hub.configure_security_automation(uuid,boolean,boolean) to service_role;
