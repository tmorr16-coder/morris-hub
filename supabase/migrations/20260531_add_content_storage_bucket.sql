-- Create storage bucket for course content files
-- Note: This may need to be created via Supabase dashboard if SQL doesn't support it
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('student-support-content', 'student-support-content', false);

-- Row-level security policies for storage bucket
-- Users can only upload to their own course content folder
insert into storage.buckets (id, name, public)
values ('student-support-content', 'student-support-content', false)
on conflict (id) do nothing;

-- Policy: Users can upload files to student-support-content bucket
-- Files are stored as: user_id/course_id/filename
create policy "users_upload_course_content" on storage.objects
  for insert with check (
    bucket_id = 'student-support-content' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view their own course content files
create policy "users_view_own_course_content" on storage.objects
  for select using (
    bucket_id = 'student-support-content' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own course content files
create policy "users_delete_own_course_content" on storage.objects
  for delete using (
    bucket_id = 'student-support-content' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
