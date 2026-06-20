-- Seed mock notifications for testing
-- Run this in Supabase SQL Editor to create test notifications
-- Using broker_id: becdd76b-0585-4aad-b3c8-41b9e50def1d (anoah1225@gmail.com)

INSERT INTO notifications (
  broker_id,
  type,
  title,
  message,
  task_id,
  customer_id,
  is_read,
  is_archived,
  created_at
) VALUES
-- Notification 1: Urgent task reminder (unread)
(
  'becdd76b-0585-4aad-b3c8-41b9e50def1d',
  'task_reminder',
  'Task Reminder',
  'Email - Need to get back to Julian about price due in 59 Minutes',
  NULL,
  NULL,
  false,
  false,
  NOW()
),
-- Notification 2: Customer update (unread)
(
  'becdd76b-0585-4aad-b3c8-41b9e50def1d',
  'customer_update',
  'Customer Update',
  'New Carrier Created: Carrier "ROUTEMASTER LOGISTICS LLC" has been created. Click here to view details.',
  NULL,
  NULL,
  false,
  false,
  NOW() - INTERVAL '2 days'
),
-- Notification 3: Task assigned (read)
(
  'becdd76b-0585-4aad-b3c8-41b9e50def1d',
  'task_assigned',
  'New Task Assigned',
  'You have been assigned task "Call prospect about quarterly shipping"',
  NULL,
  NULL,
  true,
  false,
  NOW() - INTERVAL '3 days'
);
