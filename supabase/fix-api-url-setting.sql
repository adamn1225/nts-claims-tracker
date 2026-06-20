-- FIX: Set API URL for pg_cron jobs
-- This setting is required so pg_cron can call your API endpoints

-- For production (Netlify deployment)
ALTER DATABASE postgres 
SET app.settings.api_url = 'https://sales.ntsconnect.com';

-- Verify it was set correctly
SELECT 
  name,
  setting,
  CASE 
    WHEN setting = 'https://sales.ntsconnect.com' THEN '✅ API URL is now set correctly for production'
    ELSE '⚠️  Unexpected value: ' || setting
  END as status
FROM pg_settings
WHERE name = 'app.settings.api_url';

-- NOTE: If you need to test locally, use:
-- ALTER DATABASE postgres SET app.settings.api_url = 'http://localhost:3000';
