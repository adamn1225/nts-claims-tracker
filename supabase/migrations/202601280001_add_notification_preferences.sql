-- ==========================================
-- EXTEND USER_PREFERENCES WITH NOTIFICATION SETTINGS
-- ==========================================

-- Add new notification preference columns to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS in_app_reminders JSONB DEFAULT '{"same_day": true, "1_day": true, "2_day": false, "3_day": false}'::JSONB, -- In-app reminder settings
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE, -- Master toggle for email notifications
ADD COLUMN IF NOT EXISTS email_reminders JSONB DEFAULT '{"same_day": true, "1_day": true, "2_day": false, "3_day": false}'::JSONB, -- Email reminder settings
ADD COLUMN IF NOT EXISTS default_task_date DATE DEFAULT CURRENT_DATE, -- Default date for new tasks
ADD COLUMN IF NOT EXISTS default_task_time TIME DEFAULT '09:00:00'; -- Default time for new tasks

-- ==========================================
-- ADD INDUSTRY AND SOCIAL MEDIA TO CUSTOMERS
-- ==========================================

-- Add industry and social media fields to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Create index for faster queries on notification settings
CREATE INDEX IF NOT EXISTS idx_user_preferences_broker_id ON user_preferences(broker_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_email_enabled ON user_preferences(email_notifications_enabled);
