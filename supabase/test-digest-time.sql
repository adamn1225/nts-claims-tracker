-- ============================================
-- TIMEZONE TEST SCRIPT FOR DAILY DIGEST
-- ============================================
-- Run this in Supabase SQL Editor to verify your digest times are correct
-- This will show you what time digests will be sent based on current settings

-- 1. Check what time it is right now (UTC vs EST)
SELECT 
  'Current Time Check' as test_section,
  NOW() AT TIME ZONE 'UTC' as current_utc_time,
  NOW() AT TIME ZONE 'America/New_York' as current_est_time,
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::text || ':' || LPAD(EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'UTC')::text, 2, '0') as current_utc_string,
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/New_York')::text || ':' || LPAD(EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'America/New_York')::text, 2, '0') as current_est_string;

-- 2. Check all users' digest time settings
SELECT 
  'User Digest Time Settings' as test_section,
  b.email,
  b.first_name,
  up.digest_time as stored_utc_time,
  (up.digest_time::time - interval '5 hours')::time as converted_est_time,
  up.last_digest_sent_date,
  up.email_notifications_enabled,
  CASE 
    WHEN up.email_notifications_enabled = true THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as notification_status
FROM user_preferences up
JOIN brokers b ON b.id = up.broker_id
ORDER BY b.email;

-- 3. Calculate when each user's next digest will be sent
WITH current_time AS (
  SELECT 
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::integer as utc_hour,
    EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'UTC')::integer as utc_minute,
    (EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::integer * 60 + EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'UTC')::integer) as current_minutes_utc
)
SELECT 
  'Next Digest Schedule' as test_section,
  b.email,
  up.digest_time as user_pref_utc,
  (up.digest_time::time - interval '5 hours')::time as user_pref_est,
  ct.utc_hour || ':' || LPAD(ct.utc_minute::text, 2, '0') as current_utc,
  SPLIT_PART(up.digest_time, ':', 1)::integer as pref_hour,
  SPLIT_PART(up.digest_time, ':', 2)::integer as pref_minute,
  (SPLIT_PART(up.digest_time, ':', 1)::integer * 60 + SPLIT_PART(up.digest_time, ':', 2)::integer) as pref_minutes_utc,
  ABS((SPLIT_PART(up.digest_time, ':', 1)::integer * 60 + SPLIT_PART(up.digest_time, ':', 2)::integer) - ct.current_minutes_utc) as minutes_difference,
  CASE 
    WHEN ABS((SPLIT_PART(up.digest_time, ':', 1)::integer * 60 + SPLIT_PART(up.digest_time, ':', 2)::integer) - ct.current_minutes_utc) <= 10 THEN '🔥 SENDING NOW!'
    WHEN (SPLIT_PART(up.digest_time, ':', 1)::integer * 60 + SPLIT_PART(up.digest_time, ':', 2)::integer) > ct.current_minutes_utc THEN '⏳ Later today'
    ELSE '📅 Tomorrow'
  END as send_status,
  CASE
    WHEN up.last_digest_sent_date = CURRENT_DATE THEN '✅ Already sent today'
    WHEN up.email_notifications_enabled = false THEN '❌ Notifications disabled'
    ELSE '📧 Will send when time matches'
  END as email_status
FROM user_preferences up
JOIN brokers b ON b.id = up.broker_id
CROSS JOIN current_time ct
ORDER BY minutes_difference;

-- 4. Verify cron job is configured
SELECT 
  'Cron Job Status' as test_section,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = true THEN '✅ Running'
    ELSE '❌ Disabled'
  END as status
FROM cron.job
WHERE jobname LIKE '%digest%';

-- 5. Test conversion examples
SELECT 
  'Conversion Examples' as test_section,
  '08:00' as est_display,
  '13:00' as utc_stored,
  'User wants 8 AM EST, we store 1 PM UTC' as note
UNION ALL
SELECT 
  'Conversion Examples',
  '09:30',
  '14:30',
  'User wants 9:30 AM EST, we store 2:30 PM UTC'
UNION ALL
SELECT 
  'Conversion Examples',
  '07:00',
  '12:00',
  'User wants 7 AM EST, we store 12 PM UTC';

-- 6. Check for any users with suspicious digest times
SELECT 
  'Suspicious Times Check' as test_section,
  b.email,
  up.digest_time,
  CASE 
    WHEN SPLIT_PART(up.digest_time, ':', 1)::integer < 10 THEN '⚠️ WARNING: This is probably EST stored as UTC (should be +5 hours)'
    WHEN SPLIT_PART(up.digest_time, ':', 1)::integer >= 10 AND SPLIT_PART(up.digest_time, ':', 1)::integer <= 18 THEN '✅ OK: Looks like proper UTC time (EST + 5 hours)'
    ELSE '❓ Unusual: Outside typical working hours'
  END as validation_status,
  (up.digest_time::time - interval '5 hours')::time as would_send_at_est
FROM user_preferences up
JOIN brokers b ON b.id = up.broker_id;
