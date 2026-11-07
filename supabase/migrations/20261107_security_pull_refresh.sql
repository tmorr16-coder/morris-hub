-- Retain the PR foreign key; targeted refreshes apply only to tracked PRs.
-- Create replacement uniqueness before removing the global refresh index.
create unique index security_pr_refresh_by_pull on hub.security_pr_commands(coalesce(pr_number,0)) where kind='refresh' and status in ('queued','running');
drop index hub.security_pr_one_refresh;
alter index hub.security_pr_refresh_by_pull rename to security_pr_one_refresh;
create or replace function hub.queue_security_pr_command(actor uuid, pull_number integer default null, head_sha text default null, base_sha text default null) returns uuid language plpgsql set search_path='' as $$
declare item hub.security_pulls; queued uuid;
begin
 perform pg_advisory_xact_lock(71624660);
 if head_sha is null and base_sha is null then
  select id into queued from hub.security_pr_commands where kind='refresh' and pr_number is not distinct from pull_number and status in ('queued','running');
  if queued is null then insert into hub.security_pr_commands(kind,requested_by,pr_number) values('refresh',actor,pull_number) returning id into queued; end if;
 else
  select * into item from hub.security_pulls where number=pull_number;
  if not found or item.synced_at<now()-interval '15 minutes' then raise exception 'Refresh PR details before merging'; end if;
  if item.snapshot->>'state'<>'open' or (item.snapshot->>'draft')::boolean or item.snapshot->>'head'<>head_sha or item.snapshot->>'base'<>base_sha then raise exception 'PR changed or is not open for merge. Refresh and review again'; end if;
  select id into queued from hub.security_pr_commands where pr_number=pull_number and kind='merge' and status in ('queued','running');
  if queued is null then insert into hub.security_pr_commands(kind,pr_number,expected_head,expected_base,requested_by) values('merge',pull_number,head_sha,base_sha,actor) returning id into queued; end if;
 end if;
 return queued;
end $$;
