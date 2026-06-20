-- Fix race condition in customer_id generation by using a PostgreSQL sequence
-- This ensures atomic, collision-free ID generation even with concurrent inserts

-- Step 1: Create a sequence for customer IDs
-- Start from current max ID to avoid duplicates with existing data
DO $$
DECLARE
  max_customer_num INTEGER;
BEGIN
  -- Find the current maximum numeric part of customer_id
  SELECT COALESCE(MAX(
    CASE 
      WHEN customer_id ~ '^NS-[0-9]+$' 
      THEN CAST(SUBSTRING(customer_id FROM 4) AS INTEGER)
      ELSE 0 
    END
  ), 1000) INTO max_customer_num
  FROM customers;
  
  -- Create sequence starting from next available number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS customer_id_seq START WITH %s', max_customer_num + 1);
END $$;

-- Step 2: Create a function to generate the next customer_id atomically
CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'NS-' || NEXTVAL('customer_id_seq')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Add a trigger to auto-generate customer_id on insert if not provided
-- This makes it work seamlessly with existing code
CREATE OR REPLACE FUNCTION auto_generate_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if customer_id is NULL or empty
  IF NEW.customer_id IS NULL OR NEW.customer_id = '' THEN
    NEW.customer_id := generate_customer_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for re-running script)
DROP TRIGGER IF EXISTS set_customer_id ON customers;

-- Create the trigger
CREATE TRIGGER set_customer_id
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_customer_id();

-- Grant usage on sequence to authenticated users
GRANT USAGE ON SEQUENCE customer_id_seq TO authenticated;

-- Test the function (optional - comment out after verification)
-- SELECT generate_customer_id(); -- Should return NS-<next_number>
