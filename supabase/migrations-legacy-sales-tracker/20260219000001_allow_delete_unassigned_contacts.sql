-- Allow admins and managers to delete unassigned contacts (broker_id IS NULL)
-- These are contacts in the imports page awaiting distribution

DROP POLICY IF EXISTS "Admins and managers can delete unassigned contacts" ON customers;

CREATE POLICY "Admins and managers can delete unassigned contacts"
ON customers FOR DELETE
USING (
  -- Contact is unassigned
  broker_id IS NULL
  AND
  -- User is admin or manager
  EXISTS (
    SELECT 1 FROM brokers b
    WHERE b.id = auth.uid()
    AND (b.is_admin = TRUE OR b.is_manager = TRUE)
  )
);

-- Verify current delete policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'customers' 
AND cmd = 'DELETE'
ORDER BY policyname;
