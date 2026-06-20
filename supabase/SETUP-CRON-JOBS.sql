-- =============================================================================
-- CRITICAL: Run this SQL in Supabase SQL Editor to set up cron jobs
-- =============================================================================
-- This sets up the scheduled tasks (cron jobs) for email notifications
-- Run this ONCE in your Supabase dashboard under SQL Editor
-- =============================================================================

-- Note: pg_cron and pg_net are already enabled in Supabase by default
-- If you get errors about extensions, they're already enabled - that's OK!

-- =============================================================================
-- FUNCTION 1: Send Daily Digest Emails (8 AM EST)
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_daily_digest_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_id bigint;
  response_status integer;
  api_url text;
BEGIN
  -- IMPORTANT: Replace this URL with your actual Netlify site URL
  api_url := 'https://sales.ntsconnect.com';

  -- Make HTTP request to the cron endpoint
  SELECT id, status_code INTO response_id, response_status
  FROM net.http_post(
    url := api_url || '/api/cron/send-daily-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  -- Log the response
  RAISE NOTICE 'Daily digest check response: %', response_status;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling daily digest endpoint: %', SQLERRM;
END;
$$;

-- =============================================================================
-- FUNCTION 2: Send Task Reminder Emails (15 min, 30 min, 1 hour before, etc.)
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_task_reminders_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_id bigint;
  response_status integer;
  api_url text;
BEGIN
  -- IMPORTANT: Replace this URL with your actual Netlify site URL
  api_url := 'https://sales.ntsconnect.com';

  -- Make HTTP request to the cron endpoint
  SELECT id, status_code INTO response_id, response_status
  FROM net.http_post(
    url := api_url || '/api/cron/send-task-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  -- Log the response
  RAISE NOTICE 'Task reminders check response: %', response_status;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling task reminders endpoint: %', SQLERRM;
END;
$$;

-- =============================================================================
-- SCHEDULE THE JOBS
-- =============================================================================

-- First, UNSCHEDULE any existing jobs with these names to avoid duplicates
SELECT cron.unschedule('send-daily-digest');
SELECT cron.unschedule('send-task-reminders');

-- Schedule Daily Digest (runs every 10 minutes, sends emails at user's configured time)
SELECT cron.schedule(
  'send-daily-digest',
  '*/10 * * * *',  -- Every 10 minutes
  $$SELECT trigger_daily_digest_check();$$
);

-- Schedule Task Reminders (runs every 10 minutes, sends emails when reminders are due)
SELECT cron.schedule(
  'send-task-reminders',
  '*/10 * * * *',  -- Every 10 minutes
  $$SELECT trigger_task_reminders_check();$$
);

-- =============================================================================
-- VERIFY THE JOBS ARE SCHEDULED
-- =============================================================================
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename
FROM cron.job
ORDER BY jobname;

-- Expected output: You should see 2 jobs:
-- 1. send-daily-digest (*/10 * * * *)
-- 2. send-task-reminders (*/10 * * * *)

-- =============================================================================
-- TEST THE FUNCTIONS MANUALLY (Optional)
-- =============================================================================
-- Uncomment and run these one at a time to test:
-- SELECT trigger_daily_digest_check();
-- SELECT trigger_task_reminders_check();

-- =============================================================================
-- TROUBLESHOOTING
-- =============================================================================
-- To view cron job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- To manually trigger a job:
-- SELECT cron.schedule('test-job', '* * * * *', $$SELECT now();$$);

-- To remove a job:
-- SELECT cron.unschedule('job-name-here');

-- =============================================================================
-- IMPORTANT NOTES FOR STAGING ENVIRONMENT
-- =============================================================================
-- When setting up staging, you'll need to:
-- 1. Run this entire file in the staging Supabase SQL Editor
-- 2. Update the api_url in both functions to point to your staging Netlify URL
--    Example: 'https://nts-pipeline-staging.netlify.app'
-- 3. Verify the jobs are scheduled by running the SELECT query above
