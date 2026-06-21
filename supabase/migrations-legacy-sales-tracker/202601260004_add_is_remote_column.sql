-- ==========================================
-- Add is_remote column to brokers table
-- ==========================================

ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE;

-- Index for filtering remote brokers
CREATE INDEX IF NOT EXISTS idx_brokers_is_remote ON brokers(is_remote);

-- Verify the column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'brokers'
AND column_name = 'is_remote';
