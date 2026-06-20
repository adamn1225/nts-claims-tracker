-- Migration: Fix notification type constraint
-- Date: 2026-03-16
-- Purpose: Add contact_assigned and contact_reassigned to allowed notification types
--          Previously only allowed: task_reminder, task_assigned, customer_update, system_alert

-- Drop the existing constraint
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the updated constraint with new types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'task_reminder',
  'task_assigned',
  'customer_update',
  'system_alert',
  'contact_assigned',
  'contact_reassigned'
));

-- Add comment explaining notification types
COMMENT ON COLUMN notifications.type IS 
'Notification type: task_reminder (scheduled task alerts), task_assigned (new task assigned), customer_update (customer changes), system_alert (system messages), contact_assigned (contact assigned to broker), contact_reassigned (contact reassigned to new broker)';
