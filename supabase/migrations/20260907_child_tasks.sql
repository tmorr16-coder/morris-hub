-- ============================================================
-- Child tasks, and undo for what a scan created.
--
-- 1. A scanned document fans out into to-dos and reminders on the
--    household's Today. Deleting the document has to take those with it, or
--    correcting one bad read means hunting through two lists by hand. The
--    rows now carry the document they came from.
--
-- 2. Tasks a parent sends to the child: an exercise to do, this week's
--    words to practise, or anything typed in. The child's own screen lists
--    them, the child completes them there, and the parents see it done.
-- ============================================================

alter table hub.todos     add column if not exists child_document_id uuid references hub.child_documents(id) on delete set null;
alter table hub.reminders add column if not exists child_document_id uuid references hub.child_documents(id) on delete set null;
create index if not exists todos_child_document_idx     on hub.todos(child_document_id)     where child_document_id is not null;
create index if not exists reminders_child_document_idx on hub.reminders(child_document_id) where child_document_id is not null;

create table if not exists hub.child_tasks (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references hub.family_members(id) on delete cascade,
  kind          text not null check (kind in ('exercise', 'spelling', 'reading', 'custom')),
  exercise_id   uuid references hub.child_exercises(id) on delete cascade,
  title         text not null,
  instructions  text,                        -- in the child's language
  payload       jsonb not null default '{}'::jsonb,  -- e.g. {"words": [...]} for spelling
  assigned_by   uuid not null references auth.users(id) on delete cascade,
  assigned_on   date not null default current_date,
  due_on        date,
  completed_at  timestamptz,
  stars         integer not null default 0,
  child_note    text,
  created_at    timestamptz not null default now()
);
create index if not exists child_tasks_child_idx on hub.child_tasks(child_id, completed_at, assigned_on desc);

alter table hub.child_tasks enable row level security;
drop policy if exists "guardians manage child_tasks" on hub.child_tasks;
create policy "guardians manage child_tasks" on hub.child_tasks
  for all using (hub.is_child_guardian(child_id)) with check (hub.is_child_guardian(child_id));
grant all on hub.child_tasks to authenticated, service_role;

notify pgrst, 'reload schema';
