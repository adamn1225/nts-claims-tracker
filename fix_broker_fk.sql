-- Fix the foreign key constraint on customer_statuses.broker_id
-- It's currently pointing to "users" but should point to "brokers"

-- Drop the incorrect foreign key
ALTER TABLE customer_statuses 
DROP CONSTRAINT IF EXISTS customer_statuses_broker_id_fkey;

-- Add the correct foreign key to brokers table
ALTER TABLE customer_statuses 
ADD CONSTRAINT customer_statuses_broker_id_fkey 
FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE;

-- Make broker_id NOT NULL if it has values
DO $$
BEGIN
  -- Only set NOT NULL if all rows have broker_id populated
  IF NOT EXISTS (SELECT 1 FROM customer_statuses WHERE broker_id IS NULL) THEN
    ALTER TABLE customer_statuses ALTER COLUMN broker_id SET NOT NULL;
    RAISE NOTICE 'Set broker_id to NOT NULL';
  ELSE
    RAISE NOTICE 'Skipping NOT NULL - some rows have NULL broker_id';
  END IF;
END $$;

-- Add unique constraint for broker_id + name if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_statuses_broker_name_unique'
  ) THEN
    ALTER TABLE customer_statuses 
    ADD CONSTRAINT customer_statuses_broker_name_unique 
    UNIQUE(broker_id, name);
    RAISE NOTICE 'Added unique constraint on (broker_id, name)';
  END IF;
END $$;

-- Update get_user_statuses() to filter by broker_id
DROP FUNCTION IF EXISTS get_user_statuses();

CREATE FUNCTION get_user_statuses()
RETURNS TABLE (
  id UUID,
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
  RETURN QUERY
  SELECT 
    cs.id,
    cs.name,
    cs.color,
    cs."order",
    cs.is_system,
    COUNT(c.id) as customer_count
  FROM customer_statuses cs
  LEFT JOIN customers c ON c.status = cs.name AND c.broker_id = cs.broker_id
  WHERE cs.broker_id = auth.uid()
  GROUP BY cs.id, cs.name, cs.color, cs."order", cs.is_system
  ORDER BY cs."order" ASC;
END;
$$;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Brokers can view their office statuses" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can create statuses for their office" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can update non-system statuses" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can delete empty statuses" ON customer_statuses;

-- Create broker-specific RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_statuses' 
    AND policyname = 'Brokers can view their own statuses'
  ) THEN
    CREATE POLICY "Brokers can view their own statuses"
      ON customer_statuses FOR SELECT
      USING (broker_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_statuses' 
    AND policyname = 'Brokers can create their own statuses'
  ) THEN
    CREATE POLICY "Brokers can create their own statuses"
      ON customer_statuses FOR INSERT
      WITH CHECK (broker_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_statuses' 
    AND policyname = 'Brokers can update their non-system statuses'
  ) THEN
    CREATE POLICY "Brokers can update their non-system statuses"
      ON customer_statuses FOR UPDATE
      USING (broker_id = auth.uid() AND is_system = FALSE);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_statuses' 
    AND policyname = 'Brokers can delete their empty non-system statuses'
  ) THEN
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
  END IF;
END $$;

-- Create default statuses for brokers who don't have any
INSERT INTO customer_statuses (broker_id, name, color, "order", is_system)
SELECT 
  b.id as broker_id,
  status.name,
  status.color,
  status."order",
  TRUE as is_system
FROM brokers b
CROSS JOIN (
  VALUES 
    ('Prospect', 'blue', 0),
    ('Active', 'green', 1),
    ('Won', 'purple', 2),
    ('Lost', 'slate', 3)
) AS status(name, color, "order")
WHERE NOT EXISTS (
  SELECT 1 FROM customer_statuses cs 
  WHERE cs.broker_id = b.id 
  AND cs.name = status.name
)
ON CONFLICT (broker_id, name) DO NOTHING;

SELECT 'Fixed: customer_statuses.broker_id now references brokers table' as result;
