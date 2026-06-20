-- Migration: Split full_name into first_name and last_name
-- Date: January 29, 2026

-- Step 1: Drop dependent views (we'll recreate them later)
DROP VIEW IF EXISTS broker_customer_summary CASCADE;

-- Step 2: Add new columns
ALTER TABLE brokers
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

-- Step 3: Migrate existing data (split full_name on first space)
UPDATE brokers
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
    THEN split_part(full_name, ' ', 1)
    ELSE full_name
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL;

-- Step 4: Make first_name required (after data migration)
ALTER TABLE brokers
ALTER COLUMN first_name SET NOT NULL;

-- Step 5: Drop old column (now safe since view is dropped)
ALTER TABLE brokers
DROP COLUMN full_name;

-- Step 6: Recreate the broker_customer_summary view with new columns
CREATE OR REPLACE VIEW broker_customer_summary AS
SELECT 
  b.id as broker_id,
  b.email,
  b.first_name,
  b.last_name,
  CONCAT(b.first_name, ' ', COALESCE(b.last_name, '')) as full_name,
  b.office_location,
  b.is_admin,
  b.is_manager,
  COUNT(c.id) as total_customers,
  COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_customers,
  COUNT(CASE WHEN c.status = 'prospect' THEN 1 END) as prospects
FROM brokers b
LEFT JOIN customers c ON b.id = c.broker_id
GROUP BY b.id, b.email, b.first_name, b.last_name, b.office_location, b.is_admin, b.is_manager;

-- Step 7: Update auth.users metadata (optional, for consistency)
-- This updates the display name in Supabase Auth
UPDATE auth.users u
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{first_name}',
  to_jsonb(b.first_name)
) || jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{last_name}',
  to_jsonb(COALESCE(b.last_name, ''))
)
FROM brokers b
WHERE u.id = b.id;
