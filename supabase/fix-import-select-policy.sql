-- ==========================================
-- MIGRATION: Fix SELECT Policy for Imported Contacts
-- ==========================================
-- Purpose: Allow brokers to view unassigned customers they imported
-- Issue: Brokers cannot see imported contacts because broker_id is NULL
-- Solution: Add SELECT policy based on imported_by field

-- Background:
-- - When importing CSV/Excel, contacts are created with broker_id = NULL (unassigned)
-- - The imported_by field tracks who imported the contact
-- - Current SELECT policies only allow brokers to see customers where broker_id = auth.uid()
-- - This prevents brokers from seeing the contacts they just imported!

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Brokers can view customers they imported" ON customers;

-- ==========================================
-- SELECT POLICY
-- ==========================================

-- Policy: Brokers can view customers they imported (even if unassigned)
-- Use Case: Broker imports client list and needs to see/distribute them
CREATE POLICY "Brokers can view customers they imported"
ON customers FOR SELECT
USING (
  -- Can view customers they imported, even if broker_id is NULL
  auth.uid() = imported_by
);

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Run these to verify the policy is working:

-- 1. Check all SELECT policies on customers table
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'customers' AND cmd = 'SELECT'
-- ORDER BY policyname;

-- Expected result: Should see 4+ SELECT policies including:
-- - "Admins can view all customers"
-- - "Brokers can view their own customers"
-- - "Brokers can view customers they imported" (NEW)
-- - "Managers can view customers from office brokers"

-- 2. Test as broker: view imported contacts
-- Should return contacts where imported_by = current user, regardless of broker_id
-- SELECT id, business_name, broker_id, imported_by
-- FROM customers
-- WHERE imported_by = auth.uid();

-- ==========================================
-- NOTES
-- ==========================================

-- This policy complements the existing policies:
-- 1. "Brokers can view their own customers" - for assigned customers
-- 2. "Brokers can view customers they imported" - for unassigned imports (NEW)
-- 3. "Managers can view customers from office brokers" - for office management
-- 4. "Admins can view all customers" - for full system access

-- Import Flow:
-- 1. Broker uploads CSV/Excel via /dashboard/imports
-- 2. Contacts created with broker_id = NULL, imported_by = broker_id
-- 3. Broker can now see these contacts in Import & Distribute tab
-- 4. Admin/Manager can distribute to team or broker can self-assign

-- Security Note:
-- - Brokers can only see unassigned contacts they personally imported
-- - Cannot see contacts imported by other brokers
-- - Admins/Managers can see all unassigned contacts per existing policies
