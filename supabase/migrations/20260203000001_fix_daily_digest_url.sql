-- Fix daily digest function to use hardcoded production URL
-- This replaces the app.settings.api_url approach which requires superuser permissions

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

  -- Make HTTP request to the cron endpoint using pg_net extension
  -- pg_net.http_post returns a request_id, the response comes later
  PERFORM net.http_post(
    url := api_url || '/api/cron/send-daily-digest',
    body := '{}'::jsonb
  );

  -- Log that request was made
  RAISE NOTICE 'Daily digest check request sent to: %', api_url;

  -- Log that request was made
  RAISE NOTICE 'Daily digest check request sent to: %', api_url;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling daily digest endpoint: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION trigger_daily_digest_check IS 'Calls the daily digest API endpoint (production URL: https://sales.ntsconnect.com)';
