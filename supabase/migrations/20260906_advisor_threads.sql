-- Health-advisor conversations.
--
-- The advisor held its conversation in React state and nothing else, so every
-- reload started over. That is the wrong behaviour for this screen in
-- particular: the questions people ask it are about their own labs and trends,
-- the answers cite specific figures, and a thread you cannot come back to is a
-- thread you have to reconstruct from memory the next time you wonder the same
-- thing.
--
-- Same shape as hub.panel_threads, deliberately: `thread_id` is the client's
-- own id (epoch ms at thread start), so a conversation begun offline keeps its
-- identity when it syncs, and the client can upsert without a round trip to
-- learn a server id first.

create table if not exists hub.advisor_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  thread_id   bigint not null,
  payload     jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, thread_id)
);

create index if not exists advisor_threads_user_updated_idx
  on hub.advisor_threads(user_id, updated_at desc);

alter table hub.advisor_threads enable row level security;

create policy "advisor_threads: read own" on hub.advisor_threads
  for select using (auth.uid() = user_id);

create policy "advisor_threads: insert own" on hub.advisor_threads
  for insert with check (auth.uid() = user_id);

create policy "advisor_threads: update own" on hub.advisor_threads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "advisor_threads: delete own" on hub.advisor_threads
  for delete using (auth.uid() = user_id);

grant usage on schema hub to authenticated, service_role;
grant select, insert, update, delete on hub.advisor_threads to authenticated, service_role;
