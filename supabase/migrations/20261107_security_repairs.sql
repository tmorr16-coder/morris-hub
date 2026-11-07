alter table hub.security_requests add column kind text not null default 'scan' check(kind in ('scan','repair'));
alter table hub.security_requests add column target_key text;
alter table hub.security_runs add column repairs jsonb not null default '[]';
create function hub.queue_security_repair(requested_by uuid, finding_key text default null) returns uuid language plpgsql set search_path='' as $$
declare queued hub.security_requests;
begin
 perform pg_advisory_xact_lock(71624659);
 if finding_key is not null and not exists(select 1 from hub.security_findings where key=finding_key and resolved_at is null) then raise exception 'Finding is no longer open'; end if;
 select * into queued from hub.security_requests where status='queued';
 if queued.id is null then
  insert into hub.security_requests(requested_by,kind,target_key) values(requested_by,'repair',finding_key) returning id into queued.id;
 else
  update hub.security_requests set kind='repair',target_key=case when queued.kind='repair' and queued.target_key is distinct from finding_key then null else finding_key end where id=queued.id;
 end if;
 return queued.id;
end $$;
revoke all on function hub.queue_security_repair(uuid,text) from public,anon,authenticated;
grant execute on function hub.queue_security_repair(uuid,text) to service_role;
