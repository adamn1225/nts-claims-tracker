-- =============================================================================
-- SIMPLIFIED CRON SETUP - Run this in Supabase SQL Editor
-- =============================================================================
-- This creates the cron jobs WITHOUT modifying extensions
-- Extensions (pg_cron, pg_net) are already enabled in Supabase
-- =============================================================================

-- =============================================================================
-- STEP 1: Remove any existing jobs (to avoid duplicates)
-- =============================================================================
SELECT cron.unschedule('send-daily-digest');
SELECT cron.unschedule('send-task-reminders');

-- =============================================================================
-- STEP 2: Create the trigger functions
-- =============================================================================

-- Function for daily digest emails
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

  -- Make HTTP request using pg_net
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

-- Function for task reminder emails
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

  -- Make HTTP request using pg_net
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
-- STEP 3: Schedule the cron jobs
-- =============================================================================

-- Daily digest (runs every 10 minutes, sends emails at user's configured time)
SELECT cron.schedule(
  'send-daily-digest',
  '*/10 * * * *',
  $$SELECT trigger_daily_digest_check();$$
);

-- Task reminders (runs every 10 minutes, sends emails when reminders are due)
SELECT cron.schedule(
  'send-task-reminders',
  '*/10 * * * *',
  $$SELECT trigger_task_reminders_check();$$
);

-- =============================================================================
-- STEP 4: Verify the jobs are scheduled
-- =============================================================================
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobname;

-- Expected output: You should see 2 jobs:
-- send-daily-digest (*/10 * * * *)
-- send-task-reminders (*/10 * * * *)

-- =============================================================================
-- STEP 5: Test the functions manually (OPTIONAL)
-- =============================================================================
-- Uncomment ONE line at a time to test:

-- SELECT trigger_daily_digest_check();
-- SELECT trigger_task_reminders_check();

-- =============================================================================
-- STEP 6: Check execution history
-- =============================================================================
-- Wait a few minutes, then check if jobs ran:
SELECT 
  r.runid,
  j.jobname,
  r.status,
  r.return_message,
  r.start_time
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
ORDER BY r.start_time DESC
LIMIT 10;

-- =============================================================================
-- DONE! Your cron jobs are now set up.
-- =============================================================================
-- The jobs will run every 10 minutes and check for:
-- - Task reminders that need to be sent
-- - Daily digests at each user's configured time
-- 
-- To troubleshoot, use the queries in DIAGNOSTIC-QUERIES.sql
-- =============================================================================
