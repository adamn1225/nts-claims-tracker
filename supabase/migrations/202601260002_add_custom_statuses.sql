-- ==========================================
-- CREATE CUSTOMER_STATUSES TABLE
-- ==========================================
-- Customizable Kanban board columns per office location

CREATE TABLE IF NOT EXISTS customer_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_location TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES brokers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique status names per office location
  UNIQUE(office_location, name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_statuses_office 
ON customer_statuses(office_location);

CREATE INDEX IF NOT EXISTS idx_customer_statuses_order 
ON customer_statuses(office_location, "order");

-- Row Level Security (RLS) for customer_statuses
ALTER TABLE customer_statuses ENABLE ROW LEVEL SECURITY;

-- Brokers can view statuses for their office location
CREATE POLICY "Brokers can view their office statuses"
  ON customer_statuses FOR SELECT
  USING (
    office_location IN (
      SELECT office_location FROM brokers WHERE id = auth.uid()
    )
  );

-- Managers can insert statuses for their office location
CREATE POLICY "Managers can create statuses for their office"
  ON customer_statuses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() 
      AND is_manager = TRUE
      AND office_location = customer_statuses.office_location
    )
  );

-- Managers can update non-system statuses
CREATE POLICY "Managers can update non-system statuses"
  ON customer_statuses FOR UPDATE
  USING (
    is_system = FALSE AND
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() 
      AND is_manager = TRUE
      AND office_location = customer_statuses.office_location
    )
  );

-- Managers can delete statuses that have no customers
CREATE POLICY "Managers can delete empty statuses"
  ON customer_statuses FOR DELETE
  USING (
    is_system = FALSE AND
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() 
      AND is_manager = TRUE
      AND office_location = customer_statuses.office_location
    ) AND
    NOT EXISTS (
      SELECT 1 FROM customers WHERE status = customer_statuses.name
    )
  );

-- ==========================================
-- INSERT DEFAULT SYSTEM STATUSES
-- ==========================================
-- These are the default statuses that every office starts with

INSERT INTO customer_statuses (office_location, name, color, "order", is_system) VALUES
  ('default', 'Prospect', 'blue', 0, TRUE),
  ('default', 'Active', 'green', 1, TRUE),
  ('default', 'Won', 'purple', 2, TRUE),
  ('default', 'Lost', 'slate', 3, TRUE)
ON CONFLICT (office_location, name) DO NOTHING;

-- ==========================================
-- HELPER FUNCTION: Get statuses for user
-- ==========================================
-- Function to get all statuses available to the current user

CREATE OR REPLACE FUNCTION get_user_statuses()
RETURNS TABLE (
  id UUID,
  office_location TEXT,
  name TEXT,
  color TEXT,
  "order" INTEGER,
  is_system BOOLEAN,
  customer_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_office TEXT;
BEGIN
  -- Get the user's office location
  SELECT b.office_location INTO user_office
  FROM brokers b
  WHERE b.id = auth.uid();
  
  -- If user has no office, use 'default'
  IF user_office IS NULL THEN
    user_office := 'default';
  END IF;
  
  -- Return statuses for user's office with customer counts
  RETURN QUERY
  SELECT 
    cs.id,
    cs.office_location,
    cs.name,
    cs.color,
    cs."order",
    cs.is_system,
    COUNT(c.id) as customer_count
  FROM customer_statuses cs
  LEFT JOIN customers c ON c.status = cs.name AND c.broker_id = auth.uid()
  WHERE cs.office_location = user_office
  GROUP BY cs.id, cs.office_location, cs.name, cs.color, cs."order", cs.is_system
  ORDER BY cs."order" ASC;
END;
$$;
