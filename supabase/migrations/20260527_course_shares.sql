-- ============================================================
-- course_shares : share grades and/or assignments with other
-- platform members (read-only for the recipient)
-- ============================================================

create table if not exists student_support.course_shares (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references student_support.courses(id) on delete cascade,
  owner_user_id        uuid not null references auth.users(id) on delete cascade,
  shared_with_user_id  uuid not null references auth.users(id) on delete cascade,
  share_grades         boolean not null default true,
  share_assignments    boolean not null default true,
  created_at           timestamptz not null default now(),
  unique (course_id, shared_with_user_id)
);

create index if not exists course_shares_owner_idx
  on student_support.course_shares(owner_user_id);

create index if not exists course_shares_recipient_idx
  on student_support.course_shares(shared_with_user_id);
