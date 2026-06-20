-- ==========================================
-- ENHANCE TASKS SYSTEM
-- ==========================================
-- Adds priority, expanded action types, and reminder settings

-- Drop old task type constraint and add new one with expanded types
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;

DO $$
BEGIN
  DROP TYPE IF EXISTS task_type_enum CASCADE;
  CREATE TYPE task_type_enum AS ENUM (
    'internal_reminder',
    'call',
    'email',
    'sms',
    'meeting',
    'decision_day',
    'price_check_in',
    'rate_reevaluation',
    'reactivation',
    'linkedin_connection',
    'linkedin_message',
    'video_shoutout',
    'service_feedback',
    'follow_up',
    'other'
  );
END;
$$;

-- Add new columns to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low')) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS reminder_days INTEGER[] DEFAULT ARRAY[0], -- Days before due date to send reminders (0 = same day)
ADD COLUMN IF NOT EXISTS last_reminder_sent_date DATE; -- Track which reminders have been sent

-- Update type column to use new enum-compatible text with check
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (
  type IN (
    'internal_reminder',
    'call',
    'email',
    'sms',
    'meeting',
    'decision_day',
    'price_check_in',
    'rate_reevaluation',
    'reactivation',
    'linkedin_connection',
    'linkedin_message',
    'video_shoutout',
    'service_feedback',
    'follow_up',
    'other'
  )
);

-- Create index on priority for filtering
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- ==========================================
-- NOTIFICATIONS SYSTEM
-- ==========================================
-- In-app notifications for task reminders and system events

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  
  -- Notification Details
  type TEXT NOT NULL CHECK (type IN ('task_reminder', 'task_assigned', 'customer_update', 'system_alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Links
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  link_url TEXT, -- Optional deep link
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_broker_id ON notifications(broker_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(broker_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);

-- Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE); -- Allow inserts from triggers/functions

-- ==========================================
-- FUNCTION: Create task reminder notifications
-- ==========================================
CREATE OR REPLACE FUNCTION create_task_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert notifications for tasks due today or in the next 3 days
  -- that haven't been sent yet
  INSERT INTO notifications (broker_id, type, title, message, task_id, customer_id)
  SELECT 
    t.broker_id,
    'task_reminder'::TEXT,
    'Task Due: ' || t.title,
    CASE 
      WHEN t.due_date = CURRENT_DATE THEN 'Due today at ' || COALESCE(t.due_time::TEXT, 'end of day')
      WHEN t.due_date = CURRENT_DATE + INTERVAL '1 day' THEN 'Due tomorrow at ' || COALESCE(t.due_time::TEXT, 'end of day')
      ELSE 'Due in ' || (t.due_date - CURRENT_DATE) || ' days'
    END,
    t.id,
    t.customer_id
  FROM tasks t
  WHERE 
    t.status = 'pending'
    AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
    AND (
      t.last_reminder_sent_date IS NULL 
      OR t.last_reminder_sent_date < CURRENT_DATE
    )
    AND (
      -- Check if reminder should be sent today based on reminder_days array
      (t.due_date - CURRENT_DATE) = ANY(t.reminder_days)
      OR 0 = ANY(t.reminder_days) AND t.due_date = CURRENT_DATE -- Same day reminder
    );
  
  -- Update last_reminder_sent_date for tasks we just notified
  UPDATE tasks
  SET last_reminder_sent_date = CURRENT_DATE
  WHERE 
    status = 'pending'
    AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
    AND (
      (due_date - CURRENT_DATE) = ANY(reminder_days)
      OR 0 = ANY(reminder_days) AND due_date = CURRENT_DATE
    );
END;
$$;

-- ==========================================
-- FUNCTION: Get unread notification count
-- ==========================================
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count
  FROM notifications
  WHERE broker_id = auth.uid()
    AND is_read = FALSE
    AND is_archived = FALSE;
  
  RETURN count;
END;
$$;
