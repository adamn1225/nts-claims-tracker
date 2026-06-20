-- ==========================================
-- MIGRATION: Fix Broker RLS with Security Definer Functions
-- ==========================================
-- Purpose: Use security definer functions to avoid recursive RLS policy checks

-- Drop all existing broker SELECT policies
DROP POLICY IF EXISTS "Brokers can view their own profile" ON brokers;
DROP POLICY IF EXISTS "Managers can view office brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can view all brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can manage all brokers" ON brokers;

-- Create a security definer function to get current user's role info
-- This bypasses RLS when checking roles
CREATE OR REPLACE FUNCTION public.get_my_broker_role()
RETURNS TABLE(is_manager_val BOOLEAN, is_admin_val BOOLEAN, office_val TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT is_manager, is_admin, office_location
  FROM public.brokers
  WHERE id = auth.uid();
END;
$$;

-- Recreate broker policies using the security definer function
-- Policy 1: View own profile (simplest - always works)
CREATE POLICY "Brokers can view their own profile"
  ON brokers FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Managers can view brokers in their office
CREATE POLICY "Managers can view office brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_broker_role() r
      WHERE r.is_manager_val = TRUE
      AND r.office_val IS NOT NULL
      AND r.office_val = brokers.office_location
    )
  );

-- Policy 3: Admins can view all brokers
CREATE POLICY "Admins can view all brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_broker_role() r
      WHERE r.is_admin_val = TRUE
    )
  );

-- Policy 4: Admins can manage all brokers (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all brokers"
  ON brokers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_broker_role() r
      WHERE r.is_admin_val = TRUE
    )
  );
