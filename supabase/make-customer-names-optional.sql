-- Migration: Make customer name fields optional
-- Date: March 5, 2026
-- Purpose: Allow importing personal customers (RV, boat, car transport) without business names
--          and business-only contacts without individual contact names

-- Context:
-- The customers table currently requires both business_name and contact_name to be NOT NULL.
-- This creates issues when:
-- 1. Importing personal transport customers (boats, RVs, cars) - no business name needed
-- 2. Importing company-only contacts - no individual contact person
-- 3. TMS exports with incomplete data
--
-- The application code now handles fallback logic to ensure at least one name is present,
-- so database constraints can be relaxed.

BEGIN;

-- Step 1: Ensure no actual NULL values exist before changing constraints
-- Fill in any NULL business_name with contact_name (shouldn't exist, but safety check)
UPDATE customers
SET business_name = COALESCE(contact_name, 'Unknown')
WHERE business_name IS NULL;

-- Fill in any NULL contact_name with business_name (shouldn't exist, but safety check)
UPDATE customers
SET contact_name = COALESCE(business_name, 'Unknown')
WHERE contact_name IS NULL;

-- Step 2: Make business_name nullable (idempotent - safe to run multiple times)
-- Allows importing personal customers (e.g., "John Smith" shipping his RV - no company name)
DO $$ 
BEGIN
  ALTER TABLE customers ALTER COLUMN business_name DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL; -- Column might already be nullable
END $$;

-- Step 3: Make contact_name nullable (idempotent - safe to run multiple times)
-- Allows importing business-only contacts (e.g., "ABC Logistics" with no specific person)
DO $$ 
BEGIN
  ALTER TABLE customers ALTER COLUMN contact_name DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL; -- Column might already be nullable
END $$;

-- Step 4: Add check constraint to ensure at least ONE name field is populated
-- This prevents completely blank records while allowing flexibility
-- Drop existing constraint if it exists, then recreate
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_at_least_one_name_check;

ALTER TABLE customers
ADD CONSTRAINT customers_at_least_one_name_check
CHECK (
  business_name IS NOT NULL AND business_name <> '' 
  OR 
  contact_name IS NOT NULL AND contact_name <> ''
  OR
  first_name IS NOT NULL AND first_name <> ''
);

-- Step 5: Add generic URL columns for TMS links and other systems
-- Unlike specific social media columns (linkedin_url, facebook_url, etc.),
-- these are for generic external system links (TMS, carrier portals, etc.)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS url TEXT;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS url_1 TEXT;

-- Step 6: Add helpful comments
COMMENT ON COLUMN customers.business_name IS 'Company/business name. Optional for personal customers (RV, boat, car transport). At least one name field required (business_name, contact_name, or first_name).';
COMMENT ON COLUMN customers.contact_name IS 'Contact person name. Optional for business-only contacts. At least one name field required (business_name, contact_name, or first_name).';
COMMENT ON COLUMN customers.url IS 'Generic URL field for external system links (TMS, carrier portals, etc.). Use for primary system link.';
COMMENT ON COLUMN customers.url_1 IS 'Secondary generic URL field for additional external system links.';

-- Step 7: Migrate existing url/url_1 data from import_metadata to new columns
-- This preserves data from previous imports that stored URLs in JSONB metadata
UPDATE customers
SET url = (import_metadata->>'url')::TEXT
WHERE import_metadata->>'url' IS NOT NULL AND url IS NULL;

UPDATE customers
SET url_1 = (import_metadata->>'url_1')::TEXT
WHERE import_metadata->>'url_1' IS NOT NULL AND url_1 IS NULL;

COMMIT;

-- Verification query (run manually to check):
-- SELECT 
--   COUNT(*) as total,
--   COUNT(business_name) as has_business_name,
--   COUNT(contact_name) as has_contact_name,
--   COUNT(first_name) as has_first_name,
--   COUNT(CASE WHEN business_name IS NULL AND contact_name IS NULL AND first_name IS NULL THEN 1 END) as no_names
-- FROM customers;
