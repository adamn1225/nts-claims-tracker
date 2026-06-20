-- ==========================================
-- FIX: Enable BrokerSelector - Allow Office-Based Customer Viewing
-- ==========================================
-- ISSUE: BrokerSelector dropdown shows office colleagues but can't view their customers
-- ROOT CAUSE: RLS SELECT policy only allows viewing own customers (broker_id = auth.uid())
-- SOLUTION: Replace restrictive policy with office-aware permission
--
-- CONTEXT: The BrokerViewContext correctly filters brokers by office_location,
-- showing them in the BrokerSelector dropdown. However, when a broker selects
-- a colleague to view their pipeline, the customer query fails due to RLS.
--
-- CURRENT BEHAVIOR:
-- ❌ Broker A (Chicago) can see Broker B (Chicago) in dropdown
-- ❌ Broker A clicks to view Broker B's customers
-- ❌ Query: SELECT * FROM customers WHERE broker_id = Broker_B_ID
-- ❌ RLS blocks it: auth.uid() != Broker_B_ID
--
-- EXPECTED BEHAVIOR:
-- ✅ Brokers can view customers from any broker in the same office
-- ✅ Brokers in different offices cannot see each other's customers
-- ✅ Admins can still view all customers globally
-- ✅ Managers can still view all customers in their office

-- ==========================================
-- Step 1: Drop existing policies (both old and new names)
-- ==========================================
DROP POLICY IF EXISTS "Brokers can view their own customers" ON customers;
DROP POLICY IF EXISTS "Brokers can view customers from brokers in their office" ON customers;

-- ==========================================
-- Step 2: Create new office-aware SELECT policy
-- ==========================================
CREATE POLICY "Brokers can view customers from brokers in their office"
  ON customers FOR SELECT
  USING (
    -- Can always view own customers
    auth.uid() = broker_id
    OR
    -- Can view customers belonging to brokers in the same office
    (
      -- Current user must be an active broker with an office location
      auth.uid() IN (
        SELECT id FROM brokers 
        WHERE office_location IS NOT NULL
          AND is_active = TRUE
      )
      AND
      -- Customer must belong to a broker in the same office as current user
      broker_id IN (
        SELECT b2.id FROM brokers b2
        WHERE b2.office_location = (
          SELECT office_location FROM brokers WHERE id = auth.uid()
        )
        AND b2.is_active = TRUE
        AND b2.office_location IS NOT NULL
      )
    )
  );

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- 1. Check all SELECT policies on customers table (should see 4 policies)
-- SELECT policyname, cmd, using::text
-- FROM pg_policies
-- WHERE tablename = 'customers' AND cmd = 'SELECT'
-- ORDER BY policyname;

-- Expected policies:
-- - "Admins can view all customers"
-- - "Brokers can view customers from brokers in their office" (NEW/UPDATED)
-- - "Brokers can view customers they imported"
-- - "Managers can view customers in their office"

-- 2. Test office-based viewing (run as a regular broker)
-- This should return customers from all brokers in your office:
-- SELECT 
--   c.id,
--   c.business_name,
--   c.broker_id,
--   b.first_name || ' ' || COALESCE(b.last_name, '') as broker_name,
--   b.office_location,
--   CASE 
--     WHEN c.broker_id = auth.uid() THEN 'YOUR CUSTOMER'
--     ELSE 'OFFICE COLLEAGUE'
--   END as relationship
-- FROM customers c
-- JOIN brokers b ON c.broker_id = b.id
-- WHERE b.office_location = (SELECT office_location FROM brokers WHERE id = auth.uid())
-- ORDER BY relationship, c.business_name
-- LIMIT 20;

-- ==========================================
-- ROLLBACK (if needed)
-- ==========================================
-- If you need to revert to the old restrictive policy:
-- 
-- DROP POLICY IF EXISTS "Brokers can view customers from brokers in their office" ON customers;
-- 
-- CREATE POLICY "Brokers can view their own customers"
--   ON customers FOR SELECT
--   USING (auth.uid() = broker_id);

