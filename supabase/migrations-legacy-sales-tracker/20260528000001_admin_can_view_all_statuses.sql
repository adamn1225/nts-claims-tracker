-- ==========================================
-- ADMIN CAN VIEW ALL BROKER STATUSES
-- ==========================================
-- Adds RLS policies so admins and managers can see other brokers'
-- customer_statuses rows. Without this, when an admin views another
-- broker's kanban board the SELECT returns empty (RLS blocks it) and
-- hardcoded fallback columns are shown instead of the real ones.
-- This was the root cause of the "purgatory" bug: admin renames a
-- fallback column -> customers.status bulk-update succeeds but the
-- customer_statuses rename silently no-ops (fake ID) -> broker's
-- customers get orphaned with a status that matches no column.

-- Allow admins to read any broker's statuses
CREATE POLICY "Admins can view all statuses"
  ON customer_statuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE id = auth.uid()
        AND is_admin = TRUE
    )
  );

-- Allow managers to read statuses for brokers in their own office
CREATE POLICY "Managers can view their office statuses"
  ON customer_statuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers manager_b
      JOIN brokers viewed_b ON viewed_b.id = customer_statuses.broker_id
      WHERE manager_b.id = auth.uid()
        AND manager_b.is_manager = TRUE
        AND manager_b.office_location = viewed_b.office_location
    )
  );
