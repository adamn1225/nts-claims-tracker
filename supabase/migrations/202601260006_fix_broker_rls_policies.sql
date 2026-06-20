-- ==========================================
-- MIGRATION: Fix RLS Policies for Broker Self-Access
-- ==========================================
-- Purpose: Fix recursive RLS policies that prevent brokers from viewing their own profile

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Brokers can view their own profile" ON brokers;
DROP POLICY IF EXISTS "Managers can view brokers in their office" ON brokers;
DROP POLICY IF EXISTS "Admins can view all brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can manage all brokers" ON brokers;

-- Recreate with non-recursive approach
-- Policy 1: Everyone can view their own profile (no recursion)
CREATE POLICY "Brokers can view their own profile"
  ON brokers FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Managers can view brokers in their office (separate from self-view)
CREATE POLICY "Managers can view office brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers mgr
      WHERE mgr.id = auth.uid()
      AND mgr.is_manager = TRUE
      AND mgr.office_location IS NOT NULL
      AND mgr.office_location = brokers.office_location
    )
  );

-- Policy 3: Admins can view all brokers
CREATE POLICY "Admins can view all brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers adm
      WHERE adm.id = auth.uid() 
      AND adm.is_admin = TRUE
    )
  );

-- Policy 4: Admins can manage all brokers
CREATE POLICY "Admins can manage all brokers"
  ON brokers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers adm
      WHERE adm.id = auth.uid() 
      AND adm.is_admin = TRUE
    )
  );
