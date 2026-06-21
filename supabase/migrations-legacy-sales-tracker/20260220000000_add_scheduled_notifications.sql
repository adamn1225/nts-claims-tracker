-- Add scheduled_for column to notifications table
-- This allows notifications to be created in advance but only shown when scheduled time arrives

ALTER TABLE notifications
ADD COLUMN scheduled_for timestamp with time zone;

-- Add index for efficient querying of scheduled notifications
CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);

-- Add index for broker_id + scheduled_for + is_read (common query pattern)
CREATE INDEX idx_notifications_broker_scheduled ON notifications(broker_id, scheduled_for, is_read)
WHERE is_archived = false;

COMMENT ON COLUMN notifications.scheduled_for IS 'When this notification should appear to the user. Null means show immediately.';
