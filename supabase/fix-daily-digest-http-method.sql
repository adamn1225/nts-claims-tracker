-- Fix daily digest function to use GET instead of POST
-- The API endpoint only accepts GET requests, but we were using http_post

CREATE OR REPLACE FUNCTION trigger_daily_digest_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_url text;
BEGIN
  -- Use production URL directly
  api_url := 'https://sales.ntsconnect.com';

  -- Make HTTP GET request to the cron endpoint using pg_net extension
  -- Increase timeout to 30 seconds to allow time for sending multiple emails
  PERFORM net.http_get(
    url := api_url || '/api/cron/send-daily-digest',
    timeout_milliseconds := 30000
  );

  -- Log that request was made
  RAISE NOTICE 'Daily digest GET request sent to: %', api_url;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling daily digest endpoint: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION trigger_daily_digest_check IS 'Calls the daily digest API endpoint via GET (production URL: https://sales.ntsconnect.com)';
