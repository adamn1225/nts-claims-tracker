-- Add daily digest cron job to pg_cron
-- This will check every 10 minutes and send digest emails to users at their configured time

-- Create function to call the daily digest endpoint
CREATE OR REPLACE FUNCTION trigger_daily_digest_check()
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
    api_url || '/api/cron/send-daily-digest',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  )::http_request);

  -- Log the response
  RAISE NOTICE 'Daily digest check response: % - %', response_status, response_body;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling daily digest endpoint: %', SQLERRM;
END;
$$;

-- Schedule the job to run every 10 minutes
-- This checks each user's digest_time preference and sends emails at the appropriate hour
SELECT cron.schedule(
  'send-daily-digest',              -- Job name
  '*/10 * * * *',                   -- Every 10 minutes
  $$SELECT trigger_daily_digest_check();$$
);

COMMENT ON FUNCTION trigger_daily_digest_check IS 'Calls the daily digest API endpoint every 10 minutes to send emails at user-configured times';
