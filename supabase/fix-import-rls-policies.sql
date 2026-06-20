-- ==========================================
-- MIGRATION: Fix RLS Policies for Import Functionality
-- ==========================================
-- Purpose: Allow brokers, managers, and admins to insert customers during CSV/Excel imports
-- Issue: "New row violates row level security policy" when uploading client lists
-- Root Cause: Missing INSERT policies on customers table

-- Drop existing INSERT policies if they exist (idempotent)
DROP POLICY IF EXISTS "Brokers can insert their own customers" ON customers;
DROP POLICY IF EXISTS "Admins can insert any customer" ON customers;
DROP POLICY IF EXISTS "Managers can insert unassigned customers" ON customers;
DROP POLICY IF EXISTS "Managers can insert customers for office brokers" ON customers;

-- ==========================================
-- INSERT POLICIES
-- ==========================================

-- Policy: Brokers can insert customers assigned to themselves
-- Use Case: Regular brokers importing their own client lists
CREATE POLICY "Brokers can insert their own customers"
ON customers FOR INSERT
WITH CHECK (
  -- Must be assigned to the current user
  auth.uid() = broker_id
  OR
  -- OR can insert unassigned customers (will be distributed later)
  broker_id IS NULL
);

-- Policy: Admins can insert any customer (assigned or unassigned)
-- Use Case: Admin importing client lists for the entire organization
CREATE POLICY "Admins can insert any customer"
ON customers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_admin_val = TRUE
  )
);

-- Policy: Managers can insert customers for brokers in their office
-- Use Case: Manager importing client lists and distributing to their team
CREATE POLICY "Managers can insert customers for office brokers"
ON customers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM get_my_broker_role() r
    WHERE r.is_manager_val = TRUE
    AND (
      -- Can insert unassigned customers
      customers.broker_id IS NULL
      OR
      -- Can insert customers assigned to brokers in their office
      (
        r.office_val IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM brokers b
          WHERE b.id = customers.broker_id
          AND b.office_location = r.office_val
        )
      )
      OR
      -- Can insert customers assigned to themselves
      customers.broker_id = auth.uid()
    )
  )
);

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Run these to verify policies are working:

-- 1. Check all policies on customers table
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'customers'
-- ORDER BY cmd, policyname;

-- 2. Test insert as regular broker (should succeed for own customers)
-- INSERT INTO customers (broker_id, business_name, contact_name, import_source)
-- VALUES (auth.uid(), 'Test Company', 'Test Contact', 'CSV Import Test');

-- 3. Test insert as broker for unassigned customer (should succeed)
-- INSERT INTO customers (broker_id, business_name, contact_name, import_source)
-- VALUES (NULL, 'Unassigned Company', 'Unassigned Contact', 'CSV Import Test');

-- 4. Clean up test data
-- DELETE FROM customers WHERE import_source = 'CSV Import Test';

-- ==========================================
-- NOTES
-- ==========================================

-- These INSERT policies work in conjunction with the existing SELECT, UPDATE, and DELETE policies
-- from fix-reassign-rls-policies.sql

-- Import Flow:
-- 1. User uploads CSV/Excel via /dashboard/imports
-- 2. App parses file and creates customer records
-- 3. If importing as admin: Can assign to any broker or leave unassigned
-- 4. If importing as manager: Can assign to office brokers or leave unassigned
-- 5. If importing as broker: Can only assign to self or leave unassigned
-- 6. Unassigned customers (broker_id = NULL) can be distributed later via the distribution UI

-- The imported_by field tracks who performed the import
-- The broker_id field determines who the customer is assigned to

-- Security Notes:
-- - Brokers CANNOT insert customers assigned to other brokers (prevents data poisoning)
-- - Managers are restricted to their office (prevents cross-office interference)
-- - Admins have full access (needed for organization-wide imports)
-- - All inserts are audited via created_at, updated_at, and imported_by fields
