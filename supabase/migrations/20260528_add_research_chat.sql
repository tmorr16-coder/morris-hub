-- Create research chat sessions table
create table if not exists student_support.research_chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  course_id        uuid not null references student_support.courses(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Create research chat messages table
create table if not exists student_support.research_chat_messages (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references student_support.research_chat_sessions(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  created_at       timestamptz not null default now()
);

-- Indexes for efficient querying
create index if not exists research_chat_sessions_user_id_idx
  on student_support.research_chat_sessions(user_id);

create index if not exists research_chat_sessions_course_id_idx
  on student_support.research_chat_sessions(course_id);

create index if not exists research_chat_sessions_updated_at_idx
  on student_support.research_chat_sessions(updated_at desc);

create index if not exists research_chat_messages_session_id_idx
  on student_support.research_chat_messages(session_id);

create index if not exists research_chat_messages_created_at_idx
  on student_support.research_chat_messages(session_id, created_at asc);

-- Row-level security policies
alter table student_support.research_chat_sessions enable row level security;
alter table student_support.research_chat_messages enable row level security;

-- Users can only view/edit their own sessions
create policy "users_view_own_sessions" on student_support.research_chat_sessions
  for select using (auth.uid() = user_id);

create policy "users_insert_own_sessions" on student_support.research_chat_sessions
  for insert with check (auth.uid() = user_id);

-- Users can only view messages from their own sessions
create policy "users_view_own_messages" on student_support.research_chat_messages
  for select using (
    session_id in (
      select id from student_support.research_chat_sessions
      where user_id = auth.uid()
    )
  );

create policy "users_insert_own_messages" on student_support.research_chat_messages
  for insert with check (
    session_id in (
      select id from student_support.research_chat_sessions
      where user_id = auth.uid()
    )
  );
