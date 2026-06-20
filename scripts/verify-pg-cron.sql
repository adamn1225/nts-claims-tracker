-- Run this in Supabase SQL Editor to verify pg_cron setup

-- 1. Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check if pg_net extension is enabled (required for HTTP requests)
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 3. List all scheduled cron jobs
SELECT * FROM cron.job;

-- 4. Check recent cron job execution history (last 20 runs)
SELECT 
  jobid,
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- 5. Check for failed jobs specifically
SELECT 
  jobid,
  jobname,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- 6. Verify the API URL setting (used by cron functions)
SELECT current_setting('app.settings.api_url', true) as configured_api_url;
