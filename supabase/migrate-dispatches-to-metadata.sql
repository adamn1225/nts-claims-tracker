-- Migration script to move dispatch data from notes to import_metadata
-- Run this if you already imported contacts with dispatch counts in notes field

-- Example: If your notes look like "Dispatched: 47" or "dispatches: 12"

-- Step 1: View contacts with dispatch data in notes
SELECT 
  id,
  business_name,
  notes,
  import_metadata
FROM customers
WHERE notes ILIKE '%dispatch%'
LIMIT 10;

-- Step 2: Extract dispatch count from notes and move to import_metadata
-- This handles various formats: "Dispatched: 47", "dispatches: 12", etc.

UPDATE customers
SET import_metadata = jsonb_set(
  COALESCE(import_metadata, '{}'::jsonb),
  '{dispatched}',
  to_jsonb(
    CAST(
      regexp_replace(
        SUBSTRING(notes FROM 'Dispatch(?:ed|es)?[:\s]+(\d+)'),
        '[^0-9]',
        '',
        'g'
      ) AS INTEGER
    )
  )
)
WHERE notes ~* 'Dispatch(?:ed|es)?[:\s]+\d+'
  AND (import_metadata->>'dispatched') IS NULL;

-- Step 3: Verify the migration
SELECT 
  id,
  business_name,
  notes,
  import_metadata->>'dispatched' as dispatch_count,
  import_metadata
FROM customers
WHERE import_metadata->>'dispatched' IS NOT NULL
LIMIT 20;

-- Step 4: (Optional) Clean up notes after confirming migration
-- Uncomment to remove the dispatch line from notes
/*
UPDATE customers
SET notes = regexp_replace(
  notes,
  'Dispatched?[:\s]+\d+\s*',
  '',
  'gi'
)
WHERE notes ~* 'Dispatch(?:ed|es)?[:\s]+\d+';
*/

-- Step 5: Add index for better query performance (if not already added)
CREATE INDEX IF NOT EXISTS idx_customers_import_metadata 
ON customers USING GIN (import_metadata);

-- Example queries after migration:

-- Find high-value clients (20+ dispatches)
SELECT business_name, email, phone, (import_metadata->>'dispatched')::int as dispatch_count
FROM customers
WHERE (import_metadata->>'dispatched')::int >= 20
ORDER BY (import_metadata->>'dispatched')::int DESC;

-- Get average dispatch count
SELECT AVG((import_metadata->>'dispatched')::int) as avg_dispatches
FROM customers
WHERE import_metadata->>'dispatched' IS NOT NULL;

-- Count clients by dispatch tier
SELECT 
  CASE 
    WHEN (import_metadata->>'dispatched')::int >= 50 THEN '50+ dispatches'
    WHEN (import_metadata->>'dispatched')::int >= 20 THEN '20-49 dispatches'
    WHEN (import_metadata->>'dispatched')::int >= 10 THEN '10-19 dispatches'
    WHEN (import_metadata->>'dispatched')::int >= 5 THEN '5-9 dispatches'
    ELSE '1-4 dispatches'
  END as tier,
  COUNT(*) as count
FROM customers
WHERE import_metadata->>'dispatched' IS NOT NULL
GROUP BY tier
ORDER BY MIN((import_metadata->>'dispatched')::int) DESC;
