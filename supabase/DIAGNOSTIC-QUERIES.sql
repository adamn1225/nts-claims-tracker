-- =============================================================================
-- DIAGNOSTIC QUERIES - Run these in Supabase SQL Editor to troubleshoot
-- =============================================================================

-- =============================================================================
-- 1. CHECK IF PG_CRON EXTENSION IS ENABLED
-- =============================================================================
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- Expected: Should show pg_cron extension
-- If empty: Run "CREATE EXTENSION pg_cron;"


-- =============================================================================
-- 2. CHECK IF PG_NET EXTENSION IS ENABLED (required for HTTP requests)
-- =============================================================================
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Expected: Should show pg_net extension
-- If empty: Run "CREATE EXTENSION pg_net;"


-- =============================================================================
-- 3. VIEW ALL SCHEDULED CRON JOBS
-- =============================================================================
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename
FROM cron.job
ORDER BY jobname;

-- Expected Result:
-- jobid | jobname                | schedule      | active
-- ------|------------------------|---------------|--------
-- 1     | send-daily-digest      | */10 * * * *  | t
-- 2     | send-task-reminders    | */10 * * * *  | t


-- =============================================================================
-- 4. VIEW RECENT CRON JOB EXECUTIONS
-- =============================================================================
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check for:
-- - status = 'succeeded' (good)
-- - status = 'failed' (check return_message for error)


-- =============================================================================
-- 5. CHECK RECENT TASK CREATIONS
-- =============================================================================
SELECT 
  id,
  title,
  due_date,
  due_time,
  reminder_days,  -- This is actually MINUTES now
  status,
  created_at
FROM tasks
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;


-- =============================================================================
-- 6. CHECK IF NOTIFICATIONS ARE BEING CREATED FOR TASKS
-- =============================================================================
SELECT 
  n.id,
  n.task_id,
  n.title,
  n.message,
  n.scheduled_for,
  n.is_read,
  n.created_at,
  t.title as task_title,
  t.due_date,
  t.due_time
FROM notifications n
LEFT JOIN tasks t ON n.task_id = t.id
WHERE n.created_at > now() - interval '24 hours'
ORDER BY n.created_at DESC;

-- Expected: Each task with reminders should have multiple notification records


-- =============================================================================
-- 7. CHECK FOR UPCOMING (SCHEDULED) NOTIFICATIONS
-- =============================================================================
SELECT 
  id,
  title,
  message,
  scheduled_for,
  created_at,
  task_id,
  broker_id
FROM notifications
WHERE scheduled_for > now()
ORDER BY scheduled_for ASC
LIMIT 20;

-- Expected: Should show notifications scheduled for future times


-- =============================================================================
-- 8. CHECK FOR DUE NOTIFICATIONS (should trigger emails)
-- =============================================================================
SELECT 
  id,
  title,
  message,
  scheduled_for,
  is_read,
  created_at,
  task_id,
  broker_id
FROM notifications
WHERE 
  scheduled_for IS NOT NULL 
  AND scheduled_for <= now()
  AND is_read = false
  AND is_archived = false
ORDER BY scheduled_for ASC;

-- Expected: These are the notifications that should have triggered emails


-- =============================================================================
-- 9. MANUALLY TRIGGER CRON FUNCTIONS (for testing)
-- =============================================================================
-- Uncomment and run ONE AT A TIME:

-- Test task reminders cron:
-- SELECT trigger_task_reminders_check();

-- Test daily digest cron:
-- SELECT trigger_daily_digest_check();


-- =============================================================================
-- 10. CHECK NETLIFY API ENDPOINT ACCESSIBILITY
-- =============================================================================
-- This tests if Supabase can reach your Netlify API
-- Note: pg_net stores responses in a separate table, check net._http_response
-- To test connectivity, just call the function:
SELECT net.http_post(
  url := 'https://sales.ntsconnect.com/api/health',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
) AS request_id;

-- Then check the response in the next query (#11)


-- =============================================================================
-- 11. CHECK HTTP RESPONSE HISTORY (pg_net responses)
-- =============================================================================
SELECT 
  id,
  status_code,
  content::text,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;

-- Expected: Recent responses from your API endpoints
-- status_code = 200 is good
-- Check content for error messages


-- =============================================================================
-- 12. VIEW USER NOTIFICATION PREFERENCES
-- =============================================================================
SELECT 
  b.id,
  b.email,
  b.first_name,
  b.last_name,
  up.in_app_notifications_enabled,
  up.email_notifications_enabled,
  up.digest_time
FROM brokers b
LEFT JOIN user_preferences up ON b.id = up.broker_id
WHERE b.is_active = true
ORDER BY b.first_name;


-- =============================================================================
-- 13. CLEANUP COMMANDS (use with caution!)
-- =============================================================================

-- Remove duplicate cron jobs:
-- SELECT cron.unschedule('send-task-reminders');
-- SELECT cron.unschedule('send-daily-digest');

-- Delete old test notifications:
-- DELETE FROM notifications WHERE created_at < now() - interval '7 days' AND is_archived = true;

-- Reset a task's notifications (delete and regenerate):
-- DELETE FROM notifications WHERE task_id = 'your-task-id-here';
-- Then call /api/tasks/generate-notifications with the task_id


-- =============================================================================
-- NOTES FOR DEBUGGING
-- =============================================================================
-- 
-- If cron jobs aren't running:
-- 1. Check extensions are enabled (pg_cron, pg_net)
-- 2. Check jobs are scheduled (query #3)
-- 3. Check recent executions (query #4)
-- 4. Check for errors in return_message
-- 5. Manually trigger to test (query #9)
--
-- If notifications aren't created:
-- 1. Check if /api/tasks/generate-notifications is being called
-- 2. Check browser console for errors
-- 3. Manually call the endpoint via curl
--
-- If emails aren't sent:
-- 1. Check SendGrid API key is valid
-- 2. Check email config in admin panel
-- 3. Check Netlify function logs
-- 4. Test cron endpoint manually
--
