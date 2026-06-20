-- Add import_source column to customers table
-- This tracks where imported contacts came from (e.g., file name, source tag)

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS import_source TEXT;

-- Add comment to document the field
COMMENT ON COLUMN customers.import_source IS 'Source/origin of imported contact data (e.g., filename, campaign name, data source)';

-- Create index for filtering by import source
CREATE INDEX IF NOT EXISTS idx_customers_import_source ON customers(import_source);
