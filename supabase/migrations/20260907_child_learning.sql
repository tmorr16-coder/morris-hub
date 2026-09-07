-- ============================================================
-- Child learning: what the school sends home, and what to do with it.
--
-- A first grader's school life arrives as paper: a weekly newsletter with
-- dates, spelling words and what is being taught; graded work with a score
-- and a teacher's note in the margin. Nothing in the app could hold any of
-- it, so the parents held it in their heads. These tables give it a home
-- and let the app turn it into a practice plan and household reminders.
--
-- Everything hangs off hub.family_members.id, the same anchor as
-- child_activities, so a managed (no-login) child works exactly like one
-- with an account.
--
-- Access: the owning parent, any adult in the owner's circle (the other
-- parent), and the child themself. The second of those did not exist
-- anywhere before — a child belonged to whichever parent added them, and
-- the other parent could not open the workspace at all.
-- ============================================================

-- ── Who may manage a child ───────────────────────────────────
create or replace function hub.is_child_guardian(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = hub, public
as $$
  select exists (
    select 1 from hub.family_members fm
    where fm.id = cid
      and (
        fm.user_id = auth.uid()                       -- owning parent
        or fm.member_user_id = auth.uid()             -- the child
        or exists (                                   -- an adult in the owner's circle
          select 1 from hub.family_members co
          where co.user_id = fm.user_id
            and co.member_user_id = auth.uid()
            and co.role = 'adult'
        )
      )
  );
$$;

grant execute on function hub.is_child_guardian(uuid) to authenticated, service_role;

-- Let a co-parent see the child rows in circles they belong to (the existing
-- policy covered only the owner and the member themself).
drop policy if exists "circle adults see children" on hub.family_members;
create policy "circle adults see children" on hub.family_members
  for select using (
    role = 'child' and exists (
      select 1 from hub.family_members co
      where co.user_id = family_members.user_id
        and co.member_user_id = auth.uid()
        and co.role = 'adult'
    )
  );

-- ── Documents: the paper itself ──────────────────────────────
create table if not exists hub.child_documents (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references hub.family_members(id) on delete cascade,
  kind         text not null check (kind in ('newsletter', 'graded_work', 'word_list', 'other')),
  title        text not null,
  doc_date     date,                         -- the date printed on it
  week_start   date,                         -- for a newsletter: the week it covers
  week_end     date,
  summary      text,                         -- two or three sentences, for the list
  extracted    jsonb not null default '{}'::jsonb,  -- the full structured read
  file_paths   text[] not null default '{}', -- storage objects in `child-documents`
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists child_documents_child_idx on hub.child_documents(child_id, created_at desc);

-- ── Spelling weeks ───────────────────────────────────────────
create table if not exists hub.child_spelling_weeks (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references hub.family_members(id) on delete cascade,
  document_id  uuid references hub.child_documents(id) on delete set null,
  week_start   date not null,
  week_end     date,
  pattern      text,                         -- "Silent e — long a, i and o"
  words        text[] not null default '{}',
  sight_words  text[] not null default '{}',
  test_on      date,
  practiced    jsonb not null default '{}'::jsonb,  -- word -> times practised
  created_at   timestamptz not null default now(),
  unique (child_id, week_start)
);

-- ── Assessments: graded work ─────────────────────────────────
create table if not exists hub.child_assessments (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references hub.family_members(id) on delete cascade,
  document_id      uuid references hub.child_documents(id) on delete set null,
  subject          text not null,            -- spelling | handwriting | reading | math | science | bible | other
  title            text not null,
  score            numeric,
  out_of           numeric,
  assessed_on      date,
  teacher_feedback text,                     -- verbatim, the note in the margin
  observations     jsonb not null default '[]'::jsonb,  -- what the paper shows: ["reversed d/b", ...]
  items            jsonb not null default '[]'::jsonb,  -- per-item: {prompt, written, correct}
  created_at       timestamptz not null default now()
);
create index if not exists child_assessments_child_idx on hub.child_assessments(child_id, assessed_on desc);

-- ── Exercises: the practice plan ─────────────────────────────
create table if not exists hub.child_exercises (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references hub.family_members(id) on delete cascade,
  document_id  uuid references hub.child_documents(id) on delete set null,
  title        text not null,
  skill        text,                         -- "letter formation: d", "silent-e spelling"
  rationale    text,                         -- why, citing the teacher's note or the paper
  steps        text,                         -- how to do it, in a parent's hands
  minutes      integer,
  frequency    text not null default 'daily' check (frequency in ('daily', 'three_a_week', 'weekly', 'once')),
  materials    text,
  status       text not null default 'active' check (status in ('suggested', 'active', 'done', 'dismissed')),
  due_on       date,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists child_exercises_child_idx on hub.child_exercises(child_id, status);

-- ── Practice log ─────────────────────────────────────────────
create table if not exists hub.child_practice_log (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references hub.child_exercises(id) on delete cascade,
  child_id     uuid not null references hub.family_members(id) on delete cascade,
  done_on      date not null default current_date,
  logged_by    uuid not null references auth.users(id) on delete cascade,
  note         text,
  created_at   timestamptz not null default now(),
  unique (exercise_id, done_on)
);
create index if not exists child_practice_log_child_idx on hub.child_practice_log(child_id, done_on desc);

-- ── RLS ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['child_documents', 'child_spelling_weeks', 'child_assessments', 'child_exercises', 'child_practice_log'] loop
    execute format('alter table hub.%I enable row level security', t);
    execute format('drop policy if exists "guardians manage %s" on hub.%I', t, t);
    execute format(
      'create policy "guardians manage %s" on hub.%I for all using (hub.is_child_guardian(child_id)) with check (hub.is_child_guardian(child_id))',
      t, t
    );
    execute format('grant all on hub.%I to authenticated, service_role', t);
  end loop;
end $$;

-- Existing per-child tables gain the same co-parent access.
drop policy if exists "guardians manage child activities" on hub.child_activities;
create policy "guardians manage child activities" on hub.child_activities
  for all using (hub.is_child_guardian(child_id)) with check (hub.is_child_guardian(child_id));
drop policy if exists "guardians manage child health notes" on hub.child_health_notes;
create policy "guardians manage child health notes" on hub.child_health_notes
  for all using (hub.is_child_guardian(child_id)) with check (hub.is_child_guardian(child_id));

-- ── Storage: the photographed pages ──────────────────────────
-- Private bucket. Objects are `<uploader user id>/<child id>/<document id>/<file>`;
-- policies key on the first segment, as health-records does. Reads by the
-- other parent go through signed URLs minted server-side.
insert into storage.buckets (id, name, public)
  values ('child-documents', 'child-documents', false)
  on conflict (id) do nothing;

drop policy if exists "users_upload_own_child_documents" on storage.objects;
create policy "users_upload_own_child_documents" on storage.objects
  for insert with check (
    bucket_id = 'child-documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
drop policy if exists "users_view_own_child_documents" on storage.objects;
create policy "users_view_own_child_documents" on storage.objects
  for select using (
    bucket_id = 'child-documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
drop policy if exists "users_delete_own_child_documents" on storage.objects;
create policy "users_delete_own_child_documents" on storage.objects
  for delete using (
    bucket_id = 'child-documents' and auth.uid()::text = (storage.foldername(name))[1]
  );

notify pgrst, 'reload schema';
