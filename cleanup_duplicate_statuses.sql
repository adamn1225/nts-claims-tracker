-- Clean up duplicate statuses and ensure unique constraint exists

-- Step 1: Delete ALL duplicate statuses, keeping only the first one for each broker+name combo
DELETE FROM customer_statuses cs1
USING customer_statuses cs2
WHERE cs1.id > cs2.id 
  AND cs1.broker_id = cs2.broker_id 
  AND cs1.name = cs2.name;

-- Step 2: Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_statuses_broker_name_unique'
  ) THEN
    ALTER TABLE customer_statuses 
    ADD CONSTRAINT customer_statuses_broker_name_unique 
    UNIQUE(broker_id, name);
    RAISE NOTICE 'Added unique constraint';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Step 3: Show current status count per broker
SELECT 
  b.first_name || ' ' || COALESCE(b.last_name, '') as broker_name,
  cs.name as status_name,
  COUNT(*) as count
FROM customer_statuses cs
JOIN brokers b ON b.id = cs.broker_id
GROUP BY b.first_name, b.last_name, cs.name, b.id
ORDER BY broker_name, status_name;

SELECT 'Cleanup complete! Duplicates removed.' as result;
