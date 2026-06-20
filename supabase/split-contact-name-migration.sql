-- Migration: Split contact_name into first_name and last_name
-- This updates customers that have contact_name but missing first_name/last_name

-- Update customers where first_name and last_name are null but contact_name exists
UPDATE customers
SET 
  first_name = CASE 
    WHEN POSITION(' ' IN TRIM(contact_name)) > 0 
    THEN TRIM(SPLIT_PART(TRIM(contact_name), ' ', 1))
    ELSE TRIM(contact_name)
  END,
  last_name = CASE 
    WHEN POSITION(' ' IN TRIM(contact_name)) > 0 
    THEN TRIM(SUBSTRING(TRIM(contact_name) FROM POSITION(' ' IN TRIM(contact_name)) + 1))
    ELSE NULL
  END
WHERE 
  (first_name IS NULL OR first_name = '')
  AND contact_name IS NOT NULL 
  AND TRIM(contact_name) != '';

-- Verify the migration
SELECT 
  contact_name,
  first_name,
  last_name,
  business_name
FROM customers
WHERE contact_name IS NOT NULL
LIMIT 20;
