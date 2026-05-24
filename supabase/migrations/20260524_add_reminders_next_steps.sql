-- Add next_steps field to hub.reminders table
ALTER TABLE hub.reminders ADD COLUMN IF NOT EXISTS next_steps TEXT[] DEFAULT '{}';

-- Add comment to document the column
COMMENT ON COLUMN hub.reminders.next_steps IS 'Array of next steps for research/investigation reminders';
