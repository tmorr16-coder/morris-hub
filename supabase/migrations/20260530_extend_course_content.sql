-- Extend course_content table with file upload support
alter table if exists student_support.course_content
add column if not exists file_path text,
add column if not exists extracted_text text,
add column if not exists is_uploaded boolean default false,
add column if not exists file_size_kb integer;

-- Add index on file_path for quick lookups
create index if not exists course_content_file_path_idx
  on student_support.course_content(file_path)
  where file_path is not null;

-- Add index on is_uploaded to filter user uploads
create index if not exists course_content_is_uploaded_idx
  on student_support.course_content(course_id, is_uploaded);

-- Add index on created_at for sorting by recency
create index if not exists course_content_created_at_idx
  on student_support.course_content(course_id, created_at desc);
