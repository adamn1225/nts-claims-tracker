-- Add task reminders cron job to pg_cron
-- This will check every 10 minutes and send reminder emails for upcoming tasks

-- Create function to call the task reminders endpoint
CREATE OR REPLACE FUNCTION trigger_task_reminders_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status integer;
  response_body text;
  api_url text;
BEGIN
  -- Get the app URL from environment or use default
  api_url := current_setting('app.settings.api_url', true);
  
  IF api_url IS NULL THEN
    -- Fallback to production URL if not set
    api_url := 'https://sales.ntsconnect.com';
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
  RAISE NOTICE 'Task reminders check response: % - %', response_status, response_body;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling task reminders endpoint: %', SQLERRM;
END;
$$;

-- Schedule the job to run every 10 minutes
-- This checks for tasks with time-based reminders (15 min, 30 min, 1 hour before, etc.)
SELECT cron.schedule(
  'send-task-reminders',            -- Job name
  '*/10 * * * *',                   -- Every 10 minutes
  $$SELECT trigger_task_reminders_check();$$
);

COMMENT ON FUNCTION trigger_task_reminders_check IS 'Calls the task reminders API endpoint every 10 minutes to send notification emails for upcoming tasks';
