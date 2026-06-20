-- Restore digest_time column for admin control
-- This was removed but is needed for admins to set when daily digest emails are sent
-- Regular users won't see this in their settings, only admins can change it

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS digest_time TIME DEFAULT '08:00';

COMMENT ON COLUMN user_preferences.digest_time IS 'Admin-controlled time when daily digest emails are sent (HH:MM format, e.g., 08:00)';

-- Set default 8am for all existing users
UPDATE user_preferences
SET digest_time = '08:00'
WHERE digest_time IS NULL;
