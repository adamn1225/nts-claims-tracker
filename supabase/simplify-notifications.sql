-- Simplify user notification preferences to just two boolean flags
-- Remove all the complex notification type and timing preferences

-- Add new simplified columns
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN DEFAULT true;

-- Migrate existing data: if email_notifications_enabled exists, use it
UPDATE user_preferences
SET in_app_notifications_enabled = true
WHERE in_app_notifications_enabled IS NULL;

-- Drop old complex columns that are no longer needed
ALTER TABLE user_preferences
DROP COLUMN IF EXISTS in_app_reminders,
DROP COLUMN IF EXISTS in_app_types,
DROP COLUMN IF EXISTS email_reminders,
DROP COLUMN IF EXISTS email_types,
DROP COLUMN IF EXISTS digest_time;

-- Keep email_notifications_enabled as it already exists
