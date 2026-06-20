-- Remove the CHECK constraint on customers.status to allow custom status values
-- This allows users to create custom status columns beyond the default 4

-- Drop the existing check constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;

-- Add comment explaining that status values come from customer_statuses table
COMMENT ON COLUMN customers.status IS 'Customer status - can be any value from customer_statuses table for this user';

-- Verify constraint is removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_status_check' 
    AND conrelid = 'customers'::regclass
  ) THEN
    RAISE EXCEPTION 'Failed to remove customers_status_check constraint';
  ELSE
    RAISE NOTICE 'Successfully removed customers_status_check constraint';
  END IF;
END $$;
