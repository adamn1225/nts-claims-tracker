-- Add is_active column to brokers table
-- This allows deactivating accounts without deleting Supabase Auth users
-- Default to true for all existing brokers

ALTER TABLE brokers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for faster queries on active/inactive status
CREATE INDEX IF NOT EXISTS idx_brokers_is_active ON brokers(is_active);

-- That's it! RLS policies stay the same.
-- Inactive users are handled in the middleware/app logic, not at the database level.
