-- Ask-the-panel conversations, moved off localStorage.
--
-- Threads lived only in the browser that made them: a conversation started on a
-- phone did not exist on a laptop, and when the storage budget was exceeded the
-- oldest ones were dropped without asking. Every other module already persists
-- to Supabase; this brings the panel in line.
--
-- `thread_id` is the client's own id (epoch ms at thread start), so a thread
-- created offline keeps its identity when it syncs.

create table if not exists hub.panel_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  thread_id   bigint not null,
  payload     jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, thread_id)
);

create index if not exists panel_threads_user_updated_idx
  on hub.panel_threads(user_id, updated_at desc);

alter table hub.panel_threads enable row level security;

create policy "panel_threads: read own" on hub.panel_threads
  for select using (auth.uid() = user_id);

create policy "panel_threads: insert own" on hub.panel_threads
  for insert with check (auth.uid() = user_id);

create policy "panel_threads: update own" on hub.panel_threads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "panel_threads: delete own" on hub.panel_threads
  for delete using (auth.uid() = user_id);

grant usage on schema hub to authenticated, service_role;
grant select, insert, update, delete on hub.panel_threads to authenticated, service_role;
