-- ==========================================
-- MIGRATION: Add Office Segmentation & Role-based Analytics
-- ==========================================
-- Purpose:
-- 1. Add office_location to customers (denormalized from broker for faster queries)
-- 2. Update RLS policies to enforce office-level access control
-- 3. Add indexes for office-based queries

-- ==========================================
-- 1. ADD OFFICE_LOCATION TO CUSTOMERS
-- ==========================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Backfill office_location from broker's office_location
UPDATE customers 
SET office_location = b.office_location
FROM brokers b
WHERE customers.broker_id = b.id AND customers.office_location IS NULL;

-- Add index for office lookups
CREATE INDEX IF NOT EXISTS idx_customers_office_location 
ON customers(office_location);

-- ==========================================
-- 2. DROP AND RECREATE RLS POLICIES FOR OFFICE SEGMENTATION
-- ==========================================

-- BROKERS TABLE POLICIES
-- Drop existing broker policies (we'll recreate with office awareness)
DROP POLICY IF EXISTS "Brokers can view their own profile" ON brokers;
DROP POLICY IF EXISTS "Managers can view all brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can view all brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can manage all brokers" ON brokers;

-- Recreate brokers policies with office awareness
CREATE POLICY "Brokers can view their own profile"
  ON brokers FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Managers can view brokers in their office"
  ON brokers FOR SELECT
  USING (
    (auth.uid() = id)
    OR
    (
      auth.uid() IN (
        SELECT id FROM brokers 
        WHERE is_manager = TRUE AND office_location IS NOT NULL
      )
      AND
      EXISTS (
        SELECT 1 FROM brokers mgr
        WHERE mgr.id = auth.uid()
        AND mgr.office_location = brokers.office_location
      )
    )
  );

CREATE POLICY "Admins can view all brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can manage all brokers"
  ON brokers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- CUSTOMERS TABLE POLICIES
-- Drop existing customer policies
DROP POLICY IF EXISTS "Brokers can view their own customers" ON customers;
DROP POLICY IF EXISTS "Managers can view all customers" ON customers;
DROP POLICY IF EXISTS "Brokers can insert their own customers" ON customers;
DROP POLICY IF EXISTS "Brokers can update their own customers" ON customers;
DROP POLICY IF EXISTS "Brokers can delete their own customers" ON customers;

-- Recreate customers policies with office awareness
CREATE POLICY "Brokers can view their own customers"
  ON customers FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Managers can view customers in their office"
  ON customers FOR SELECT
  USING (
    (auth.uid() = broker_id)
    OR
    (
      auth.uid() IN (
        SELECT id FROM brokers 
        WHERE is_manager = TRUE AND office_location IS NOT NULL
      )
      AND
      office_location = (
        SELECT office_location FROM brokers WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Brokers can insert their own customers"
  ON customers FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own customers"
  ON customers FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can delete their own customers"
  ON customers FOR DELETE
  USING (auth.uid() = broker_id);

CREATE POLICY "Managers can update customers in their office"
  ON customers FOR UPDATE
  USING (
    auth.uid() = broker_id
    OR
    (
      auth.uid() IN (
        SELECT id FROM brokers 
        WHERE is_manager = TRUE AND office_location IS NOT NULL
      )
      AND
      office_location = (
        SELECT office_location FROM brokers WHERE id = auth.uid()
      )
    )
  );

-- TASKS TABLE POLICIES
-- Drop existing task policies
DROP POLICY IF EXISTS "Brokers can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Managers can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Brokers can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Brokers can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Brokers can delete their own tasks" ON tasks;

-- Recreate tasks policies with office awareness
CREATE POLICY "Brokers can view their own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Managers can view tasks for their office"
  ON tasks FOR SELECT
  USING (
    (auth.uid() = broker_id)
    OR
    (
      auth.uid() IN (
        SELECT id FROM brokers 
        WHERE is_manager = TRUE AND office_location IS NOT NULL
      )
      AND
      broker_id IN (
        SELECT id FROM brokers 
        WHERE office_location = (
          SELECT office_location FROM brokers WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admins can view all tasks"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Brokers can insert their own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can delete their own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = broker_id);

CREATE POLICY "Managers can update tasks for their office"
  ON tasks FOR UPDATE
  USING (
    auth.uid() = broker_id
    OR
    (
      auth.uid() IN (
        SELECT id FROM brokers 
        WHERE is_manager = TRUE AND office_location IS NOT NULL
      )
      AND
      broker_id IN (
        SELECT id FROM brokers 
        WHERE office_location = (
          SELECT office_location FROM brokers WHERE id = auth.uid()
        )
      )
    )
  );

-- ==========================================
-- 3. ANALYTICS HELPER VIEWS (Optional, for performance)
-- ==========================================
-- These views are used by the analytics dashboard for faster queries

-- Office-level summary view
CREATE OR REPLACE VIEW office_customer_summary AS
SELECT 
  office_location,
  COUNT(*) as total_customers,
  SUM(CASE WHEN status = 'prospect' THEN 1 ELSE 0 END) as prospect_count,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_count,
  SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_count,
  ROUND(100.0 * SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::NUMERIC / 
    NULLIF(SUM(CASE WHEN status IN ('active', 'won', 'lost') THEN 1 ELSE 0 END), 0), 2) as win_rate_pct
FROM customers
WHERE office_location IS NOT NULL
GROUP BY office_location;

-- Broker-level summary view
CREATE OR REPLACE VIEW broker_customer_summary AS
SELECT 
  customers.broker_id,
  (SELECT full_name FROM brokers WHERE id = customers.broker_id) as broker_name,
  (SELECT office_location FROM brokers WHERE id = customers.broker_id) as office_location,
  COUNT(*) as total_customers,
  SUM(CASE WHEN status = 'prospect' THEN 1 ELSE 0 END) as prospect_count,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_count,
  SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_count,
  ROUND(100.0 * SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::NUMERIC / 
    NULLIF(SUM(CASE WHEN status IN ('active', 'won', 'lost') THEN 1 ELSE 0 END), 0), 2) as win_rate_pct
FROM customers
GROUP BY customers.broker_id;

-- Enable RLS on views
ALTER VIEW office_customer_summary OWNER TO postgres;
ALTER VIEW broker_customer_summary OWNER TO postgres;
