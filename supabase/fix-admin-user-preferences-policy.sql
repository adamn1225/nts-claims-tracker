-- Fix the admin user preferences policy
-- The original policy was missing the WITH CHECK clause
-- which is required for UPDATE operations to allow modifying any row

-- Drop the existing broken policy
DROP POLICY IF EXISTS "Admins can update all preferences" ON user_preferences;

-- Recreate with both USING (for selecting rows) and WITH CHECK (for updating rows)
CREATE POLICY "Admins can update all preferences"
  ON user_preferences FOR UPDATE
  USING (
    -- Admin can SELECT any row
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.id = auth.uid() 
      AND brokers.is_admin = true
    )
  )
  WITH CHECK (
    -- Admin can UPDATE any row to any value
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.id = auth.uid() 
      AND brokers.is_admin = true
    )
  );

COMMENT ON POLICY "Admins can update all preferences" ON user_preferences IS 
  'Allows admin users to update any user preference record (includes WITH CHECK for UPDATE operations)';
