-- ============================================================
-- student_support schema for the student hub
-- ============================================================

create schema if not exists student_support;

-- ============================================================
-- courses : user's courses for the semester
-- ============================================================
create table if not exists student_support.courses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  instructor       text,
  semester         text,                     -- e.g., "Fall 2024", "Spring 2025"
  color_tag        text default '#3b82f6',   -- for UI color coding
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists courses_user_idx on student_support.courses(user_id, created_at desc);

-- ============================================================
-- course_content : syllabus, books, notes, etc. for a course
-- ============================================================
create table if not exists student_support.course_content (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references student_support.courses(id) on delete cascade,
  type             text not null,            -- syllabus|book|notes|resource|other
  title            text not null,
  description      text,
  content_url      text,                     -- for external links
  file_name        text,                     -- original file name if uploaded
  imported_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists course_content_course_idx on student_support.course_content(course_id);

-- ============================================================
-- course_reminders : tests, assignments, quizzes, etc.
-- ============================================================
create table if not exists student_support.course_reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  course_id        uuid not null references student_support.courses(id) on delete cascade,
  type             text not null,            -- test|assignment|quiz|practice|extra_credit
  title            text not null,
  description      text,
  due_date         date not null,
  due_time         time,                     -- optional time component
  is_completed     boolean default false,
  completed_at     timestamptz,
  reminder_sent    boolean default false,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists course_reminders_user_idx on student_support.course_reminders(user_id, due_date);
create index if not exists course_reminders_course_idx on student_support.course_reminders(course_id, due_date);
create index if not exists course_reminders_unsent_idx on student_support.course_reminders(user_id, reminder_sent, due_date) where not reminder_sent;

-- ============================================================
-- flashcard_sets : groups of flashcards for a course
-- ============================================================
create table if not exists student_support.flashcard_sets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  course_id        uuid not null references student_support.courses(id) on delete cascade,
  name             text not null,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists flashcard_sets_user_idx on student_support.flashcard_sets(user_id);
create index if not exists flashcard_sets_course_idx on student_support.flashcard_sets(course_id);

-- ============================================================
-- flashcards : individual study cards with context
-- ============================================================
create table if not exists student_support.flashcards (
  id               uuid primary key default gen_random_uuid(),
  set_id           uuid not null references student_support.flashcard_sets(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  question         text not null,
  answer           text not null,
  context          text,                     -- additional context/explanation
  difficulty       integer default 1,        -- 1-5 scale
  last_reviewed    timestamptz,
  review_count     integer default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists flashcards_set_idx on student_support.flashcards(set_id);
create index if not exists flashcards_user_idx on student_support.flashcards(user_id);

-- ============================================================
-- student_settings : per-user student support preferences
-- ============================================================
create table if not exists student_support.student_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  reminder_enabled boolean default true,
  reminder_email   text,                     -- where to send reminders
  reminder_lead_days integer default 1,      -- days before event to send reminder
  auto_import_notes boolean default false,   -- auto-import notes as flashcards
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table student_support.courses enable row level security;
alter table student_support.course_content enable row level security;
alter table student_support.course_reminders enable row level security;
alter table student_support.flashcard_sets enable row level security;
alter table student_support.flashcards enable row level security;
alter table student_support.student_settings enable row level security;

-- Users can only see their own courses
create policy "courses: read own" on student_support.courses
  for select using (auth.uid() = user_id);
create policy "courses: insert own" on student_support.courses
  for insert with check (auth.uid() = user_id);
create policy "courses: update own" on student_support.courses
  for update using (auth.uid() = user_id);
create policy "courses: delete own" on student_support.courses
  for delete using (auth.uid() = user_id);

-- Users can only see course content for their own courses
create policy "course_content: read own" on student_support.course_content
  for select using (
    course_id in (
      select id from student_support.courses where user_id = auth.uid()
    )
  );
create policy "course_content: insert own" on student_support.course_content
  for insert with check (
    course_id in (
      select id from student_support.courses where user_id = auth.uid()
    )
  );
create policy "course_content: update own" on student_support.course_content
  for update using (
    course_id in (
      select id from student_support.courses where user_id = auth.uid()
    )
  );
create policy "course_content: delete own" on student_support.course_content
  for delete using (
    course_id in (
      select id from student_support.courses where user_id = auth.uid()
    )
  );

-- Users can only see their own reminders
create policy "course_reminders: read own" on student_support.course_reminders
  for select using (auth.uid() = user_id);
create policy "course_reminders: insert own" on student_support.course_reminders
  for insert with check (auth.uid() = user_id);
create policy "course_reminders: update own" on student_support.course_reminders
  for update using (auth.uid() = user_id);
create policy "course_reminders: delete own" on student_support.course_reminders
  for delete using (auth.uid() = user_id);

-- Users can only see their own flashcard sets
create policy "flashcard_sets: read own" on student_support.flashcard_sets
  for select using (auth.uid() = user_id);
create policy "flashcard_sets: insert own" on student_support.flashcard_sets
  for insert with check (auth.uid() = user_id);
create policy "flashcard_sets: update own" on student_support.flashcard_sets
  for update using (auth.uid() = user_id);
create policy "flashcard_sets: delete own" on student_support.flashcard_sets
  for delete using (auth.uid() = user_id);

-- Users can only see their own flashcards
create policy "flashcards: read own" on student_support.flashcards
  for select using (auth.uid() = user_id);
create policy "flashcards: insert own" on student_support.flashcards
  for insert with check (auth.uid() = user_id);
create policy "flashcards: update own" on student_support.flashcards
  for update using (auth.uid() = user_id);
create policy "flashcards: delete own" on student_support.flashcards
  for delete using (auth.uid() = user_id);

-- Users can only see their own settings
create policy "student_settings: read own" on student_support.student_settings
  for select using (auth.uid() = user_id);
create policy "student_settings: insert own" on student_support.student_settings
  for insert with check (auth.uid() = user_id);
create policy "student_settings: update own" on student_support.student_settings
  for update using (auth.uid() = user_id);

-- ============================================================
-- Grants
-- ============================================================
grant usage on schema student_support to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema student_support to authenticated;
grant all on all tables in schema student_support to service_role;

-- ============================================================
-- Triggers
-- ============================================================
drop trigger if exists set_updated_at on student_support.courses;
create trigger set_updated_at before update on student_support.courses
  for each row execute function hub.set_updated_at();

drop trigger if exists set_updated_at on student_support.course_reminders;
create trigger set_updated_at before update on student_support.course_reminders
  for each row execute function hub.set_updated_at();

drop trigger if exists set_updated_at on student_support.flashcard_sets;
create trigger set_updated_at before update on student_support.flashcard_sets
  for each row execute function hub.set_updated_at();

drop trigger if exists set_updated_at on student_support.flashcards;
create trigger set_updated_at before update on student_support.flashcards
  for each row execute function hub.set_updated_at();

drop trigger if exists set_updated_at on student_support.student_settings;
create trigger set_updated_at before update on student_support.student_settings
  for each row execute function hub.set_updated_at();
