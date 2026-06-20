-- =============================================================================
-- FIX: Cron job HTTP response parsing error
-- =============================================================================
-- Error: column "id" does not exist
-- Cause: net.http_post() is async - doesn't return id/status_code directly
-- Fix: Just call the function without capturing response (fire and forget)
-- =============================================================================

-- Fixed function for daily digest emails
CREATE OR REPLACE FUNCTION trigger_daily_digest_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_url text;
BEGIN
  -- Your Netlify site URL
  api_url := 'https://sales.ntsconnect.com';

  -- Make HTTP request using pg_net (fire and forget)
  PERFORM net.http_post(
    url := api_url || '/api/cron/send-daily-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  RAISE NOTICE 'Daily digest check triggered';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling daily digest endpoint: %', SQLERRM;
END;
$$;

-- Fixed function for task reminder emails
CREATE OR REPLACE FUNCTION trigger_task_reminders_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_url text;
BEGIN
  -- Your Netlify site URL
  api_url := 'https://sales.ntsconnect.com';

  -- Make HTTP request using pg_net (fire and forget)
  PERFORM net.http_post(
    url := api_url || '/api/cron/send-task-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  RAISE NOTICE 'Task reminders check triggered';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling task reminders endpoint: %', SQLERRM;
END;
$$;

-- =============================================================================
-- AFTER RUNNING THIS:
-- =============================================================================
-- The cron jobs will now work correctly.
-- They'll call your API endpoints every 10 minutes to send emails.
-- 
-- To verify:
-- 1. Wait 10 minutes for next cron run
-- 2. Check Netlify function logs for email sending attempts
-- 3. Check your email inbox for task reminders
-- =============================================================================
