-- Query to view all active pg_cron jobs
-- Run this in Supabase SQL Editor to check for duplicates

SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
ORDER BY jobname;

-- Expected result: You should see:
-- 1. 'check-overdue-tasks' - runs hourly (0 * * * *)
-- 2. 'send-daily-digest' - runs every 10 minutes (*/10 * * * *)

-- If you see DUPLICATE jobs with the same name, delete the extras:
-- SELECT cron.unschedule('job-name-here');
