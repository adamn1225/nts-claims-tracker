-- ==========================================
-- UPDATE RLS POLICY: Allow all brokers to create custom statuses
-- ==========================================
-- Previously only managers could create custom columns
-- Now all brokers can customize their own pipeline

-- Drop the old manager-only insert policy
DROP POLICY IF EXISTS "Managers can create statuses for their office" ON customer_statuses;

-- Create new policy allowing all brokers to create statuses for their office
CREATE POLICY "Brokers can create statuses for their office"
  ON customer_statuses FOR INSERT
  WITH CHECK (
    office_location IN (
      SELECT b.office_location FROM brokers b 
      WHERE b.id = auth.uid()
    )
  );

-- Update the update policy to allow all brokers (not just managers) to edit non-system statuses
DROP POLICY IF EXISTS "Managers can update non-system statuses" ON customer_statuses;

CREATE POLICY "Brokers can update non-system statuses"
  ON customer_statuses FOR UPDATE
  USING (
    is_system = FALSE AND
    office_location IN (
      SELECT b.office_location FROM brokers b
      WHERE b.id = auth.uid()
    )
  );

-- Update the delete policy to allow all brokers (not just managers) to delete empty statuses
DROP POLICY IF EXISTS "Managers can delete empty statuses" ON customer_statuses;

CREATE POLICY "Brokers can delete empty statuses"
  ON customer_statuses FOR DELETE
  USING (
    is_system = FALSE AND
    office_location IN (
      SELECT b.office_location FROM brokers b
      WHERE b.id = auth.uid()
    ) AND
    NOT EXISTS (
      SELECT 1 FROM customers 
      WHERE status = customer_statuses.name
    )
  );
