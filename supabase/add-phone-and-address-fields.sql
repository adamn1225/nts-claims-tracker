-- ====================================================================
-- ADD ADDITIONAL PHONE AND ADDRESS FIELDS
-- ====================================================================
-- Adds support for multiple phone numbers with extensions and
-- secondary address for regional contacts vs HQ
--
-- Created: March 8, 2026
-- ====================================================================

-- Add phone extensions and additional phone numbers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phone_ext TEXT,           -- Extension for primary phone
  ADD COLUMN IF NOT EXISTS phone_2 TEXT,             -- Direct office number
  ADD COLUMN IF NOT EXISTS phone_2_ext TEXT,         -- Extension for phone 2
  ADD COLUMN IF NOT EXISTS phone_3 TEXT,             -- Main/HQ phone number
  ADD COLUMN IF NOT EXISTS phone_3_ext TEXT;         -- Extension for phone 3

-- Add secondary address fields (for regional office when different from HQ)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS address_2 TEXT,           -- Secondary street address
  ADD COLUMN IF NOT EXISTS city_2 TEXT,              -- Secondary city
  ADD COLUMN IF NOT EXISTS state_2 TEXT,             -- Secondary state
  ADD COLUMN IF NOT EXISTS zip_2 TEXT;               -- Secondary ZIP

-- Add comments for clarity
COMMENT ON COLUMN customers.phone IS 'Primary phone (e.g., cell)';
COMMENT ON COLUMN customers.phone_ext IS 'Extension for primary phone';
COMMENT ON COLUMN customers.phone_2 IS 'Direct office number';
COMMENT ON COLUMN customers.phone_2_ext IS 'Extension for direct office number';
COMMENT ON COLUMN customers.phone_3 IS 'Main/HQ phone number';
COMMENT ON COLUMN customers.phone_3_ext IS 'Extension for main/HQ number';
COMMENT ON COLUMN customers.address IS 'Primary/HQ address';
COMMENT ON COLUMN customers.city IS 'Primary/HQ city';
COMMENT ON COLUMN customers.state IS 'Primary/HQ state';
COMMENT ON COLUMN customers.zip IS 'Primary/HQ ZIP code';
COMMENT ON COLUMN customers.address_2 IS 'Secondary/regional office address';
COMMENT ON COLUMN customers.city_2 IS 'Secondary/regional office city';
COMMENT ON COLUMN customers.state_2 IS 'Secondary/regional office state';
COMMENT ON COLUMN customers.zip_2 IS 'Secondary/regional office ZIP';

-- Verification
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN (
    'phone_ext', 'phone_2', 'phone_2_ext', 'phone_3', 'phone_3_ext',
    'address_2', 'city_2', 'state_2', 'zip_2'
  )
ORDER BY column_name;
