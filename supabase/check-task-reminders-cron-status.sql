-- Check if task reminders cron job is running and when it last ran

-- 1. Check if the cron job is scheduled
SELECT 
  jobid,
  schedule,
  command,
  active,
  CASE WHEN active THEN '✅ Job is active' ELSE '❌ Job is not active' END as status
FROM cron.job
WHERE jobname = 'send-task-reminders';

-- 2. Check recent execution history
SELECT 
  runid,
  jobid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-task-reminders')
ORDER BY start_time DESC
LIMIT 10;

-- 3. Test the function manually to see if it works
-- (This will actually call the API endpoint once)
-- SELECT trigger_task_reminders_check();
