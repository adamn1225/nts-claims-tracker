-- Add imported_by field to customers table to track who imported the contact
-- This is essential for permission filtering on the imports page

ALTER TABLE customers
ADD COLUMN imported_by UUID REFERENCES brokers(id) ON DELETE SET NULL;

-- Create index for faster queries on imported_by
CREATE INDEX idx_customers_imported_by ON customers(imported_by);

-- Add comment to explain the field
COMMENT ON COLUMN customers.imported_by IS 'ID of the broker who imported this contact (NULL for manually created contacts)';

-- Update existing imported contacts to set imported_by based on import_source
-- For now, we can't retroactively determine who imported old contacts
-- So we'll leave them null and they'll be visible to all admins
