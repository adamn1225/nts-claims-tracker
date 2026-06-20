-- =============================================================================
-- CLEANUP OLD CRON JOBS
-- =============================================================================
-- You have duplicate/old cron jobs that need to be removed
-- Run this to clean them up
-- =============================================================================

-- View current jobs first
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- Remove OLD jobs (these use outdated syntax and functions)
SELECT cron.unschedule('check-overdue-tasks');     -- OLD: uses deprecated http extension
SELECT cron.unschedule('check-task-reminders');    -- OLD: calls old function name

-- Your CURRENT (correct) jobs should be:
-- 1. send-daily-digest (*/10 * * * *)
-- 2. send-task-reminders (*/10 * * * *)

-- Verify only the correct jobs remain:
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- Expected result: Only 2 jobs
-- - send-daily-digest
-- - send-task-reminders

-- =============================================================================
-- DONE! Old jobs removed.
-- =============================================================================
