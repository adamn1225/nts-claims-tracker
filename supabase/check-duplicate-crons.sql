-- Run this in Supabase SQL Editor to see all active cron jobs

-- View all scheduled cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
ORDER BY jobname;

-- View recent job runs to see what's actually executing
SELECT 
  j.jobname,
  jr.job_pid,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE jr.start_time > NOW() - INTERVAL '24 hours'
ORDER BY jr.start_time DESC
LIMIT 50;
