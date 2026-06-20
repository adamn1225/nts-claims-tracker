-- Remove default task settings columns from user_preferences
-- These were removed from the UI and are no longer needed

ALTER TABLE user_preferences
DROP COLUMN IF EXISTS default_task_date,
DROP COLUMN IF EXISTS default_task_time;
