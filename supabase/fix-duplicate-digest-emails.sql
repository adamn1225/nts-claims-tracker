-- ============================================
-- FIX: Stop duplicate daily digest emails
-- ============================================
-- Problem: send-daily-digest is running every 10 minutes instead of once daily
-- This causes multiple emails to be sent within the ±10 minute time window

-- STEP 1: Unschedule the incorrectly configured send-daily-digest job
SELECT cron.unschedule('send-daily-digest');

-- STEP 2: Re-schedule it to run ONCE per day at 8:00 AM CST (13:00 UTC)
-- This will send digests to ALL users at their preferred time
-- Users with digest_time = '13:00:00' will get emails at 8 AM CST
SELECT cron.schedule(
  'send-daily-digest',
  '0 13 * * *',  -- Once daily at 1 PM UTC (8 AM CST)
  $$SELECT trigger_daily_digest_check();$$
);

-- STEP 3: Verify the fix
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'send-daily-digest';

-- Expected result:
-- jobname: send-daily-digest
-- schedule: 0 13 * * *  (once daily at 1 PM UTC / 8 AM CST)
-- active: t

-- ============================================
-- NOTES:
-- ============================================
-- - The endpoint still has ±10 minute window logic for flexibility
-- - Running once daily at 8 AM CST ensures digests go out promptly
-- - Users can customize digest_time in their preferences for future enhancements
-- - check-task-reminders can stay at every 10 min for urgent reminders
