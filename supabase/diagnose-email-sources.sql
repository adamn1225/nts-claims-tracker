-- 🔍 DIAGNOSTIC: Find source of duplicate emails
-- Run this in Supabase SQL Editor to see ALL scheduled jobs

-- ============================================
-- 1. Show all pg_cron jobs currently scheduled
-- ============================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
ORDER BY jobname;

-- ============================================
-- 2. Show recent job executions (last 2 hours)
-- ============================================
SELECT 
  j.jobname,
  jr.status,
  jr.return_message,
  jr.start_time AT TIME ZONE 'America/Chicago' as start_time_cst,
  jr.end_time AT TIME ZONE 'America/Chicago' as end_time_cst,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) as duration_seconds
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE jr.start_time > NOW() - INTERVAL '2 hours'
ORDER BY jr.start_time DESC;

-- ============================================
-- 3. Count how many times each job ran today
-- ============================================
SELECT 
  j.jobname,
  COUNT(*) as executions_today,
  MIN(jr.start_time AT TIME ZONE 'America/Chicago') as first_run_cst,
  MAX(jr.start_time AT TIME ZONE 'America/Chicago') as last_run_cst
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE jr.start_time > CURRENT_DATE
GROUP BY j.jobname
ORDER BY executions_today DESC;

-- ============================================
-- 4. TO DISABLE A DUPLICATE JOB, USE:
-- ============================================
-- SELECT cron.unschedule('job-name-here');
--
-- Example to disable the old job:
-- SELECT cron.unschedule('check-task-reminders');
-- SELECT cron.unschedule('send-daily-digest');
