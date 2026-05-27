-- Extend student_settings table with SMS reminder configuration
alter table if exists student_support.student_settings
add column if not exists phone_number text,
add column if not exists reminder_enabled boolean default true,
add column if not exists reminder_lead_days integer default 3 check (reminder_lead_days between 1 and 7),
add column if not exists sms_notifications_enabled boolean default true;

-- Create index on phone_number for quick lookups
create index if not exists student_settings_phone_number_idx
  on student_support.student_settings(phone_number)
  where phone_number is not null;

-- Add trigger to update updated_at timestamp on changes
create or replace function student_support.update_student_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists student_settings_updated_at_trigger on student_support.student_settings;
create trigger student_settings_updated_at_trigger
  before update on student_support.student_settings
  for each row
  execute function student_support.update_student_settings_updated_at();
