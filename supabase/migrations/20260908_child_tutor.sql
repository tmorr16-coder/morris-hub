-- ============================================================
-- Buddy's conversations, kept for the parents to read.
--
-- The tutor talks to a six-year-old on a handed-over phone. Every exchange
-- is stored so a parent can see what was asked and what was said, by day
-- and by sitting. Guardians (owner, co-parent) and the child may read;
-- rows are written by the tutor route under the signed-in parent.
-- ============================================================

create table if not exists hub.child_tutor_messages (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references hub.family_members(id) on delete cascade,
  session_id  uuid not null,                    -- one sitting on the child's screen
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists child_tutor_messages_child_idx on hub.child_tutor_messages(child_id, created_at desc);

alter table hub.child_tutor_messages enable row level security;
drop policy if exists "guardians read child_tutor_messages" on hub.child_tutor_messages;
create policy "guardians read child_tutor_messages" on hub.child_tutor_messages
  for all using (hub.is_child_guardian(child_id)) with check (hub.is_child_guardian(child_id));
grant all on hub.child_tutor_messages to authenticated, service_role;

notify pgrst, 'reload schema';
