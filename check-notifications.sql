-- Check for recently created tasks (last 2 hours)
SELECT 
  id,
  title,
  due_date,
  due_time,
  reminder_days,
  created_at,
  broker_id
FROM tasks
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 5;

-- Check for notifications associated with these tasks
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
WHERE n.created_at > NOW() - INTERVAL '2 hours'
ORDER BY n.created_at DESC;
