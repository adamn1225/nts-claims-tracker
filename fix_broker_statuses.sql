-- ==========================================
-- FIX MULTI-TENANT STATUS BUG
-- ==========================================
-- Run this script directly in Supabase SQL Editor to fix the issue
-- where brokers see each other's column rename changes

-- Step 1: Ensure broker_id column exists with correct foreign key
DO $$ 
BEGIN
  -- Add broker_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_statuses' 
    AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE customer_statuses 
    ADD COLUMN broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added broker_id column';
  ELSE
    RAISE NOTICE 'broker_id column already exists';
    
    -- Drop incorrect foreign key if it references users instead of brokers
    IF EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage 
      WHERE table_name = 'users' 
      AND constraint_name = 'customer_statuses_broker_id_fkey'
    ) THEN
      ALTER TABLE customer_statuses DROP CONSTRAINT customer_statuses_broker_id_fkey;
      RAISE NOTICE 'Dropped incorrect foreign key to users table';
      
      -- Add correct foreign key to brokers table
      ALTER TABLE customer_statuses 
      ADD CONSTRAINT customer_statuses_broker_id_fkey 
      FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added correct foreign key to brokers table';
    END IF;
  END IF;
END $$;

-- Step 2: Populate broker_id for any NULL values
DO $$
DECLARE
  status_record RECORD;
  first_broker_id UUID;
  updated_count INT := 0;
  created_count INT := 0;
BEGIN
  -- Get first broker ID
  SELECT id INTO first_broker_id FROM brokers LIMIT 1;
  
  IF first_broker_id IS NULL THEN
    RAISE NOTICE 'No brokers found in database. Skipping status migration.';
    RETURN;
  END IF;
  
  -- For each status without broker_id
  FOR status_record IN 
    SELECT * FROM customer_statuses WHERE broker_id IS NULL
  LOOP
    -- Assign to first broker
    UPDATE customer_statuses 
    SET broker_id = first_broker_id
    WHERE id = status_record.id;
    
    updated_count := updated_count + 1;
    
    -- Create copies for OTHER brokers
    INSERT INTO customer_statuses (
      broker_id,
      name,
      color,
      "order",
      is_system,
      created_by,
      created_at,
      updated_at
    )
    SELECT 
      b.id,
      status_record.name,
      COALESCE(status_record.color, 'blue'),
      status_record."order",
      status_record.is_system,
      b.id,
      NOW(),
      NOW()
    FROM brokers b
    WHERE b.id != first_broker_id
    ON CONFLICT (broker_id, name) DO NOTHING;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
  END LOOP;
  
  RAISE NOTICE 'Updated % status records, created % copies for other brokers', updated_count, created_count;
END $$;

-- Step 3: Make broker_id NOT NULL
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
    
    RAISE NOTICE 'Set broker_id to NOT NULL';
  ELSE
    RAISE NOTICE 'broker_id is already NOT NULL';
  END IF;
END $$;

-- Step 4: Update constraints
ALTER TABLE customer_statuses 
DROP CONSTRAINT IF EXISTS customer_statuses_office_location_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_statuses_broker_name_unique'
  ) THEN
    ALTER TABLE customer_statuses 
    ADD CONSTRAINT customer_statuses_broker_name_unique 
    UNIQUE(broker_id, name);
    
    RAISE NOTICE 'Added broker_name unique constraint';
  ELSE
    RAISE NOTICE 'Broker_name unique constraint already exists';
  END IF;
END $$;

-- Step 5: Update indexes
DROP INDEX IF EXISTS idx_customer_statuses_office;
DROP INDEX IF EXISTS idx_customer_statuses_order;

CREATE INDEX IF NOT EXISTS idx_customer_statuses_broker 
ON customer_statuses(broker_id);

CREATE INDEX IF NOT EXISTS idx_customer_statuses_broker_order 
ON customer_statuses(broker_id, "order");

-- Step 6: Drop old RLS policies
DROP POLICY IF EXISTS "Brokers can view their office statuses" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can create statuses for their office" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can update non-system statuses" ON customer_statuses;
DROP POLICY IF EXISTS "Managers can delete empty statuses" ON customer_statuses;

-- Step 7: Create BROKER-SPECIFIC RLS policies
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
    RAISE NOTICE 'Created SELECT policy';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_statuses' 
    AND policyname = 'Brokers can create their own statuses'
  ) THEN
    CREATE POLICY "Brokers can create their own statuses"
      ON customer_statuses FOR INSERT
      WITH CHECK (broker_id = auth.uid());
    RAISE NOTICE 'Created INSERT policy';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_statuses' 
    AND policyname = 'Brokers can update their non-system statuses'
  ) THEN
    CREATE POLICY "Brokers can update their non-system statuses"
      ON customer_statuses FOR UPDATE
      USING (broker_id = auth.uid() AND is_system = FALSE);
    RAISE NOTICE 'Created UPDATE policy';
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
    RAISE NOTICE 'Created DELETE policy';
  END IF;
END $$;

-- Step 8: Update get_user_statuses() function
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
  -- Return statuses for CURRENT BROKER ONLY
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

-- Step 9: Create default statuses for brokers who don't have them
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

-- Final verification query (run this to check)
-- SELECT 
--   b.full_name,
--   cs.name as status_name,
--   cs.broker_id
-- FROM customer_statuses cs
-- JOIN brokers b ON b.id = cs.broker_id
-- ORDER BY b.full_name, cs."order";

SELECT 'Multi-tenant status bug fix completed! Each broker now has their own statuses.' as result;
