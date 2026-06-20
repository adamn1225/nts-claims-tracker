-- =============================================================================
-- FIX: Allow service role to insert notifications
-- =============================================================================
-- The /api/tasks/generate-notifications endpoint uses service_role
-- We need to ensure RLS policies allow notification creation
-- =============================================================================

-- Check current RLS policies on notifications table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications';

-- Grant service role full access to notifications table
-- (Service role should bypass RLS, but let's be explicit)
GRANT ALL ON notifications TO service_role;

-- Ensure RLS is enabled but service_role can bypass
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- Create explicit policy for service_role inserts
CREATE POLICY "Service role can insert notifications"
ON notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Verify broker RLS policy still works for regular users
-- This ensures brokers can only see their own notifications
DROP POLICY IF EXISTS "Brokers can view own notifications" ON notifications;
CREATE POLICY "Brokers can view own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (broker_id = auth.uid());

-- Allow brokers to update their own notifications (mark as read, etc.)
DROP POLICY IF EXISTS "Brokers can update own notifications" ON notifications;
CREATE POLICY "Brokers can update own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (broker_id = auth.uid())
WITH CHECK (broker_id = auth.uid());

-- Verify policies
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- =============================================================================
-- Test notification creation
-- =============================================================================
-- After running this, try creating a task again
-- Then check if notifications appear:
-- SELECT * FROM notifications WHERE created_at > now() - interval '5 minutes';
-- =============================================================================
