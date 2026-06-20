-- Add flexible metadata column for import data
-- This handles varying spreadsheet columns like "Dispatched", "First Dispatch Date", etc.

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS import_metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_import_metadata 
ON customers USING GIN (import_metadata);

-- Add comment explaining usage
COMMENT ON COLUMN customers.import_metadata IS 
'Flexible JSONB storage for import-specific data like dispatch counts, TMS dates, outcomes. 
Example: {"dispatched": 47, "first_dispatch_date": "2024-01-15", "recent_dispatch_date": "2025-12-10", "shipper_type": "B2B"}';

-- Example queries:
-- Get customers with >20 dispatches: WHERE (import_metadata->>'dispatched')::int > 20
-- Get recent shippers: WHERE import_metadata->>'recent_dispatch_date' > '2025-01-01'
-- Get B2B only: WHERE import_metadata->>'shipper_type' = 'B2B'
