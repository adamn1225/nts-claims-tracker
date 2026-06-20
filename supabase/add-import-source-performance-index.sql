-- ============================================================
-- Add Performance Index for import_source
-- ============================================================
-- Purpose: Speed up import_source duplicate checks and filtering
-- Optional: This improves performance but doesn't change functionality
-- ============================================================

-- Add case-insensitive index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_customers_import_source_lower 
ON customers (LOWER(import_source));

-- Add regular index for exact matches (filtering in UI)
CREATE INDEX IF NOT EXISTS idx_customers_import_source 
ON customers (import_source) 
WHERE import_source IS NOT NULL;

-- Verify indexes created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'customers' 
  AND indexname LIKE '%import_source%'
ORDER BY indexname;

-- ============================================================
-- Benefits:
-- - Faster duplicate validation during imports
-- - Faster filtering by import_source in UI
-- - Better performance as data grows
-- ============================================================
