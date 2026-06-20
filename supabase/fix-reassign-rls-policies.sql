-- ==========================================
-- MIGRATION: Add RLS Policies for Reassign Functionality
-- ==========================================
-- Purpose: Allow admins and managers to view and reassign customers across their scope
-- Use Case: Reassigning contacts when brokers leave, get fired, or change roles

-- The existing manager policies check customer.office_location, but we need to check
-- the broker's office_location instead (since customers may not have office set).

-- Drop existing policies that we'll replace (idempotent - can run multiple times)
DROP POLICY IF EXISTS "Managers can view customers in their office" ON customers;
DROP POLICY IF EXISTS "Managers can update customers in their office" ON customers;
DROP POLICY IF EXISTS "Admins can update all customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete any customer" ON customers;
DROP POLICY IF EXISTS "Managers can view customers from office brokers" ON customers;
DROP POLICY IF EXISTS "Managers can update customers from office brokers" ON customers;
DROP POLICY IF EXISTS "Managers can delete office customers" ON customers;

-- Policy: Admins can view all customers (already exists, keeping for reference)
-- CREATE POLICY "Admins can view all customers"
-- ON customers FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM brokers
--     WHERE brokers.id = auth.uid()
--     AND brokers.is_admin = true
--   )
-- );

-- Policy: Admins can update all customers (NEW - needed for reassignment)
CREATE POLICY "Admins can update all customers"
ON customers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_admin_val = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_admin_val = TRUE
  )
);

-- Policy: Admins can delete any customer (NEW - for cleanup)
CREATE POLICY "Admins can delete any customer"
ON customers FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_admin_val = TRUE
  )
);

-- Policy: Managers can view customers from brokers in their office (IMPROVED)
-- This checks the broker's office, not the customer's office
CREATE POLICY "Managers can view customers from office brokers"
ON customers FOR SELECT
USING (
  -- Own customers
  auth.uid() = broker_id
  OR
  -- Customers assigned to brokers in same office
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_manager_val = TRUE
    AND r.office_val IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = customers.broker_id
      AND b.office_location = r.office_val
    )
  )
  OR
  -- Unassigned customers (broker_id is null) can be viewed by managers
  (
    broker_id IS NULL
    AND EXISTS (
      SELECT 1 FROM get_my_broker_role() r
      WHERE r.is_manager_val = TRUE
    )
  )
);

-- Policy: Managers can update customers from brokers in their office (IMPROVED)
-- This allows reassignment within the office
CREATE POLICY "Managers can update customers from office brokers"
ON customers FOR UPDATE
USING (
  -- Own customers
  auth.uid() = broker_id
  OR
  -- Customers assigned to brokers in same office
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_manager_val = TRUE
    AND r.office_val IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = customers.broker_id
      AND b.office_location = r.office_val
    )
  )
  OR
  -- Unassigned customers can be assigned by managers
  (
    broker_id IS NULL
    AND EXISTS (
      SELECT 1 FROM get_my_broker_role() r
      WHERE r.is_manager_val = TRUE
    )
  )
)
WITH CHECK (
  -- Can update to any broker in their office or unassign
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_manager_val = TRUE
    AND r.office_val IS NOT NULL
    AND (
      -- Assigning to a broker in same office
      EXISTS (
        SELECT 1 FROM brokers b
        WHERE b.id = customers.broker_id
        AND b.office_location = r.office_val
      )
      OR
      -- Unassigning (setting to null)
      customers.broker_id IS NULL
    )
  )
  OR
  -- Can always update own customers
  auth.uid() = broker_id
);

-- Policy: Managers can delete customers from their office (NEW)
CREATE POLICY "Managers can delete office customers"
ON customers FOR DELETE
USING (
  -- Own customers
  auth.uid() = broker_id
  OR
  -- Customers from office brokers
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_manager_val = TRUE
    AND r.office_val IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = customers.broker_id
      AND b.office_location = r.office_val
    )
  )
);

-- Summary of changes:
-- 1. Admins can now UPDATE and DELETE any customer (needed for reassignment)
-- 2. Manager policies now check broker's office via JOIN instead of customer.office_location
-- 3. Managers can view/update unassigned customers (broker_id IS NULL)
-- 4. Managers can delete customers from their office brokers
