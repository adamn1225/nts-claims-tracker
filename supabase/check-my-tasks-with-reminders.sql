-- Check tasks with due times and reminders for your broker ID

-- Simple view of tasks with reminders
SELECT 
  id,
  title,
  due_date,
  due_time,
  reminder_days,
  last_reminder_sent_date,
  created_at,
  -- Calculate due timestamp
  (due_date || ' ' || due_time)::timestamp as due_timestamp
FROM tasks
WHERE 
  broker_id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee'
  AND due_date >= CURRENT_DATE
  AND due_time IS NOT NULL
  AND reminder_days IS NOT NULL
  AND array_length(reminder_days, 1) > 0
ORDER BY due_date, due_time;

-- Detailed view showing when each reminder should fire
SELECT 
  t.id,
  t.title,
  t.due_date,
  t.due_time,
  r.reminder_minute,
  (t.due_date || ' ' || t.due_time)::timestamp as due_timestamp,
  (t.due_date || ' ' || t.due_time)::timestamp - (r.reminder_minute || ' minutes')::interval as reminder_time,
  NOW() as current_time,
  CASE 
    WHEN NOW() BETWEEN 
      ((t.due_date || ' ' || t.due_time)::timestamp - (r.reminder_minute || ' minutes')::interval - interval '10 minutes')
      AND
      ((t.due_date || ' ' || t.due_time)::timestamp - (r.reminder_minute || ' minutes')::interval + interval '10 minutes')
    THEN '✅ IN REMINDER WINDOW NOW'
    WHEN NOW() < ((t.due_date || ' ' || t.due_time)::timestamp - (r.reminder_minute || ' minutes')::interval - interval '10 minutes')
    THEN '⏳ Future reminder'
    ELSE '⏰ Reminder window passed'
  END as window_status,
  t.last_reminder_sent_date
FROM tasks t
CROSS JOIN LATERAL unnest(t.reminder_days) AS r(reminder_minute)
WHERE 
  t.broker_id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee'
  AND t.due_date >= CURRENT_DATE
  AND t.due_time IS NOT NULL
  AND t.reminder_days IS NOT NULL
  AND array_length(t.reminder_days, 1) > 0
ORDER BY t.due_date, t.due_time, r.reminder_minute;
