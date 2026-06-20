-- Add address-related columns to customers table
-- Run this in Supabase SQL Editor

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT;

-- Add comment for documentation
COMMENT ON COLUMN customers.address IS 'Street address of customer location';
COMMENT ON COLUMN customers.city IS 'City of customer location';
COMMENT ON COLUMN customers.state IS 'State/Province of customer location';
COMMENT ON COLUMN customers.zip IS 'ZIP/Postal code of customer location';

-- After running this, regenerate TypeScript types:
-- npm run db:types
