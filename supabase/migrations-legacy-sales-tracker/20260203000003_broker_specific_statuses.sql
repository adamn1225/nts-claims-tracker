-- ==========================================
-- MAKE CUSTOMER_STATUSES BROKER-SPECIFIC
-- ==========================================
-- Changes statuses from office-wide to broker-specific
-- Each broker can now customize their own Kanban columns

-- Step 1: Add broker_id column if it doesn't exist (nullable initially)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_statuses' 
    AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE customer_statuses 
    ADD COLUMN broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Populate broker_id for existing statuses
-- Copy each office's statuses to every broker in that office
DO $$
DECLARE
  status_record RECORD;
  broker_record RECORD;
BEGIN
  -- For each existing status
  FOR status_record IN 
    SELECT * FROM customer_statuses
  LOOP
    -- For each broker in that office, create a copy of the status
    FOR broker_record IN 
      SELECT id FROM brokers 
      WHERE office_location = status_record.office_location
    LOOP
      -- Update first broker to own the original record
      IF status_record.broker_id IS NULL THEN
        UPDATE customer_statuses 
        SET broker_id = broker_record.id
        WHERE id = status_record.id;
        
        -- Mark as updated so we don't process again
        status_record.broker_id := broker_record.id;
      ELSE
        -- Create duplicate for other brokers in the office
        INSERT INTO customer_statuses (
          broker_id,
          office_location,
          name,
          color,
          "order",
          is_system,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          broker_record.id,
          status_record.office_location,
          status_record.name,
          status_record.color,
          status_record."order",
          status_record.is_system,
          broker_record.id,
          NOW(),
          NOW()
        ) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Step 3: Make broker_id NOT NULL now that all rows have values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_statuses' 
    AND column_name = 'broker_id' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE customer_statuses 
    ALTER COLUMN broker_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Drop old office-based unique constraint
ALTER TABLE customer_statuses 
DROP CONSTRAINT IF EXISTS customer_statuses_office_location_name_key;

-- Step 5: Add new broker-based unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_statuses_broker_name_unique'
  ) THEN
    ALTER TABLE customer_statuses 
    ADD CONSTRAINT customer_statuses_broker_name_unique 
    UNIQUE(broker_id, name);
  END IF;
END $$;

-- Step 6: Update indexes
DROP INDEX IF EXISTS idx_customer_statuses_office;
DROP INDEX IF EXISTS idx_customer_statuses_order;

CREATE INDEX IF NOT EXISTS idx_customer_statuses_broker 
ON customer_statuses(broker_id);

CREATE INDEX IF NOT EXISTS idx_customer_statuses_broker_order 
ON customer_statuses(broker_id, "order");

-- Step 7: Drop old RLS policies
DROP POLICY IF EXISTS "Brokers can view their office statuses" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can create statuses for their office" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can update non-system statuses" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can delete empty statuses" ON customer_statuses;

-- Step 8: Create new broker-specific RLS policies
CREATE POLICY "Brokers can view their own statuses"
  ON customer_statuses FOR SELECT
  USING (broker_id = auth.uid());

CREATE POLICY "Brokers can create their own statuses"
  ON customer_statuses FOR INSERT
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can update their non-system statuses"
  ON customer_statuses FOR UPDATE
  USING (
    broker_id = auth.uid() AND 
    is_system = FALSE
  );

CREATE POLICY "Brokers can delete their empty non-system statuses"
  ON customer_statuses FOR DELETE
  USING (
    broker_id = auth.uid() AND
    is_system = FALSE AND
    NOT EXISTS (
      SELECT 1 FROM customers 
      WHERE status = customer_statuses.name 
      AND broker_id = customer_statuses.broker_id
    )
  );

-- Step 9: Update get_user_statuses() function
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
BEGIN
  -- Return statuses for current broker with customer counts
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
  LEFT JOIN customers c ON c.status = cs.name AND c.broker_id = cs.broker_id
  WHERE cs.broker_id = auth.uid()
  GROUP BY cs.id, cs.office_location, cs.name, cs.color, cs."order", cs.is_system
  ORDER BY cs."order" ASC;
END;
$$;

-- Step 10: Create default statuses for any existing brokers who don't have them
INSERT INTO customer_statuses (broker_id, office_location, name, "order", is_system)
SELECT 
  b.id as broker_id,
  b.office_location,
  status.name,
  status."order",
  TRUE as is_system
FROM brokers b
CROSS JOIN (
  VALUES 
    ('Prospect', 0),
    ('Active', 1),
    ('Won', 2),
    ('Lost', 3)
) AS status(name, "order")
WHERE NOT EXISTS (
  SELECT 1 FROM customer_statuses cs 
  WHERE cs.broker_id = b.id 
  AND cs.name = status.name
)
ON CONFLICT (broker_id, name) DO NOTHING;

COMMENT ON COLUMN customer_statuses.broker_id IS 'Each broker has their own custom Kanban columns';
COMMENT ON CONSTRAINT customer_statuses_broker_name_unique ON customer_statuses IS 'Status names must be unique per broker';
