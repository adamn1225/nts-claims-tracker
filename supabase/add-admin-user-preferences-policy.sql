-- Allow admins to update all user preferences (needed for global digest time setting)
-- This enables the admin panel to change digest_time for everyone at once

CREATE POLICY "Admins can update all preferences"
  ON user_preferences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.id = auth.uid() 
      AND brokers.is_admin = true
    )
  );

COMMENT ON POLICY "Admins can update all preferences" ON user_preferences IS 
  'Allows admin users to update any user preference record, needed for global settings like digest_time';
