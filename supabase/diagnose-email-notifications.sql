-- EMAIL NOTIFICATION DIAGNOSTIC QUERIES
-- Run these queries in Supabase SQL Editor to diagnose email issues

-- 1. CHECK YOUR EMAIL NOTIFICATION SETTINGS
SELECT 
  b.email,
  b.first_name,
  b.last_name,
  up.email_notifications_enabled,
  up.digest_time,
  up.last_digest_sent_date,
  CASE 
    WHEN up.email_notifications_enabled = false THEN '❌ Email notifications are DISABLED - Enable in Settings'
    WHEN up.email_notifications_enabled = true THEN '✅ Email notifications are ENABLED'
    ELSE '⚠️  No user preferences found'
  END as status
FROM brokers b
LEFT JOIN user_preferences up ON up.broker_id = b.id
WHERE b.id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee'; -- Your broker ID

-- 2. CHECK FOR TASKS WITH REMINDERS (that should send emails)
SELECT 
  t.title,
  t.due_date,
  t.due_time,
  t.status,
  t.reminder_days,
  t.last_reminder_sent_date,
  b.email as broker_email,
  b.first_name,
  CASE 
    WHEN t.due_time IS NULL THEN '⚠️ No due_time set (emails need specific time)'
    WHEN t.reminder_days IS NULL OR array_length(t.reminder_days, 1) = 0 THEN '⚠️ No reminders configured'
    WHEN t.status != 'pending' THEN '⚠️ Task status is not pending'
    ELSE '✅ Task configured correctly for reminders'
  END as reminder_status
FROM tasks t
LEFT JOIN brokers b ON b.id = t.broker_id
WHERE t.broker_id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee'
  AND t.due_date >= CURRENT_DATE
ORDER BY t.due_date, t.due_time
LIMIT 10;

-- 3. CHECK IF CRON JOBS ARE REGISTERED
SELECT 
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = true THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status,
  command
FROM cron.job
WHERE jobname LIKE '%task%' OR jobname LIKE '%digest%' OR jobname LIKE '%reminder%'
ORDER BY jobname;

-- 4. CHECK RECENT CRON JOB EXECUTIONS
SELECT 
  j.jobname,
  r.runid,
  r.start_time AT TIME ZONE 'America/Chicago' as start_time_cst,
  r.status,
  CASE 
    WHEN r.status = 'succeeded' THEN '✅'
    WHEN r.status = 'failed' THEN '❌'
    ELSE '⚠️'
  END as icon,
  r.return_message,
  r.database
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
WHERE j.jobname LIKE '%task%' OR j.jobname LIKE '%digest%' OR j.jobname LIKE '%reminder%'
ORDER BY r.start_time DESC
LIMIT 20;

-- 5. CHECK API URL SETTING (critical for cron to work)
SELECT 
  name,
  setting,
  CASE 
    WHEN setting = 'https://sales.ntsconnect.com' THEN '✅ Production URL is set correctly'
    WHEN setting IS NULL THEN '❌ API URL is NOT SET - Cron jobs will fail!'
    ELSE '⚠️  Custom URL: ' || setting
  END as status
FROM pg_settings
WHERE name = 'app.settings.api_url';

-- If the above returns no rows, the setting doesn't exist. You can set it with:
-- ALTER DATABASE postgres SET app.settings.api_url = 'https://sales.ntsconnect.com';

-- 6. CHECK IF EMAIL CONFIG EXISTS
SELECT 
  from_email,
  from_name,
  CASE 
    WHEN sendgrid_api_key IS NOT NULL THEN '✅ SendGrid API key is set'
    ELSE '❌ No SendGrid API key in database'
  END as sendgrid_status,
  provider_priority
FROM email_config
LIMIT 1;

-- 7. SUMMARY: What needs to be fixed?
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM user_preferences 
      WHERE broker_id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee' 
      AND email_notifications_enabled = true
    ) THEN '❌ 1. Enable email notifications in Settings'
    ELSE '✅ 1. Email notifications are enabled'
  END as check_1,
  
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM tasks 
      WHERE broker_id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee'
      AND status = 'pending'
      AND due_time IS NOT NULL
      AND reminder_days IS NOT NULL
      AND array_length(reminder_days, 1) > 0
    ) THEN '⚠️  2. No tasks with valid reminders (need due_time + reminder_days)'
    ELSE '✅ 2. Tasks with reminders exist'
  END as check_2,
  
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'send-task-reminders' 
      AND active = true
    ) THEN '❌ 3. Cron job "send-task-reminders" is NOT active'
    ELSE '✅ 3. Cron job is registered and active'
  END as check_3,
  
  CASE 
    WHEN current_setting('app.settings.api_url', true) IS NULL 
    THEN '❌ 4. API URL not set in database settings'
    ELSE '✅ 4. API URL is configured: ' || current_setting('app.settings.api_url', true)
  END as check_4;
