-- Fix notification preference columns in user_preferences table
-- Run this migration in your Supabase SQL Editor

-- STEP 1: Change email_reminders from BOOLEAN to JSONB
-- First, backup any existing boolean values and convert them
ALTER TABLE user_preferences 
DROP COLUMN IF EXISTS email_reminders;

ALTER TABLE user_preferences
ADD COLUMN email_reminders JSONB DEFAULT '{"same_day": true, "1_day": true, "2_day": false, "3_day": false, "1_week": false}'::jsonb;

-- STEP 2: Add missing columns
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS in_app_types JSONB DEFAULT '{"task_reminders": true, "customer_updates": true, "follow_up_reminders": true, "overdue_alerts": true, "daily_digest": false}'::jsonb,
ADD COLUMN IF NOT EXISTS email_types JSONB DEFAULT '{"task_reminders": true, "customer_updates": false, "follow_up_reminders": true, "overdue_alerts": true, "daily_digest": false}'::jsonb,
ADD COLUMN IF NOT EXISTS digest_time TEXT DEFAULT '08:00';

-- Add comments for documentation
COMMENT ON COLUMN user_preferences.in_app_reminders IS 'JSON object of reminder timing settings for in-app notifications';
COMMENT ON COLUMN user_preferences.email_reminders IS 'JSON object of reminder timing settings for email notifications';
COMMENT ON COLUMN user_preferences.in_app_types IS 'JSON object of notification types enabled for in-app notifications';
COMMENT ON COLUMN user_preferences.email_types IS 'JSON object of notification types enabled for email notifications';
COMMENT ON COLUMN user_preferences.digest_time IS 'Time of day for daily digest email (HH:MM format)';
