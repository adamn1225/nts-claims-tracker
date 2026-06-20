-- Enable pg_cron extension for scheduled database jobs
-- This allows minute-by-minute checking of user notification preferences
-- Note: pg_cron is already enabled in Supabase Pro+ plans
-- Note: Permissions are already configured by Supabase

-- Create a simple config table for storing the API URL
CREATE TABLE IF NOT EXISTS cron_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Insert default API URL (can be updated later)
INSERT INTO cron_config (key, value)
VALUES ('api_url', 'https://sales.ntsconnect.com')
ON CONFLICT (key) DO NOTHING;

-- Grant access to authenticated users (read-only)
GRANT SELECT ON cron_config TO authenticated;

-- Create a function to get the API URL
CREATE OR REPLACE FUNCTION get_api_url()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT value FROM cron_config WHERE key = 'api_url';
$$;

-- Create a function to call the notification API endpoint
-- This function will be called by pg_cron every 2 minutes
CREATE OR REPLACE FUNCTION trigger_task_reminder_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status integer;
  response_body text;
  api_url text;
BEGIN
  -- Get the app URL from config table
  api_url := get_api_url();
  
  IF api_url IS NULL THEN
    RAISE WARNING 'API URL not configured in cron_config table';
    RETURN;
  END IF;

  -- Make HTTP request to the cron endpoint
  SELECT status, body INTO response_status, response_body
  FROM http((
    'POST',
    api_url || '/api/cron/send-task-reminders',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  )::http_request);

  -- Log the response
  RAISE NOTICE 'Task reminder check response: % - %', response_status, response_body;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling task reminder endpoint: %', SQLERRM;
END;
$$;

-- Note: pg_net extension is already enabled by default in Supabase

-- Unschedule existing jobs if they exist (safe cleanup for re-running migration)
DO $$ 
BEGIN
  PERFORM cron.unschedule('check-task-reminders');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  PERFORM cron.unschedule('check-overdue-tasks');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- Schedule the job to run every 2 minutes
-- This ensures short-interval reminders (10-30 min before task) arrive on time
-- Variance: ±1 minute (acceptable for meeting prep use cases)
SELECT cron.schedule(
  'check-task-reminders',           -- Job name
  '*/2 * * * *',                    -- Every 2 minutes
  $$SELECT trigger_task_reminder_check();$$
);

-- Schedule overdue task check (hourly is fine for this)
SELECT cron.schedule(
  'check-overdue-tasks',            -- Job name
  '0 * * * *',                      -- Every hour at minute 0
  $$
  SELECT status, body
  FROM http((
    'POST',
    (SELECT value FROM cron_config WHERE key = 'api_url') || '/api/cron/check-overdue-tasks',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  )::http_request);
  $$
);

-- Create a view to monitor cron jobs
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- Grant access to view cron jobs
GRANT SELECT ON cron_job_status TO authenticated;

COMMENT ON VIEW cron_job_status IS 'Monitor scheduled cron jobs for task reminders';

-- To update the API URL later, run:
-- UPDATE cron_config SET value = 'https://your-new-domain.com', updated_at = now() WHERE key = 'api_url';
