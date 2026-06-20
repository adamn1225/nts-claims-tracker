-- Add secondary contact fields to customers table
-- This allows storing a second contact person for each company
-- Temporary solution until proper multi-contact system is implemented

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS first_name2 TEXT,
  ADD COLUMN IF NOT EXISTS last_name2 TEXT,
  ADD COLUMN IF NOT EXISTS job_title2 TEXT,
  ADD COLUMN IF NOT EXISTS phone2 TEXT,
  ADD COLUMN IF NOT EXISTS email2 TEXT;

-- Add comments for documentation
COMMENT ON COLUMN customers.first_name2 IS 'Second contact first name';
COMMENT ON COLUMN customers.last_name2 IS 'Second contact last name';
COMMENT ON COLUMN customers.job_title2 IS 'Second contact job title/position';
COMMENT ON COLUMN customers.phone2 IS 'Second contact phone number';
COMMENT ON COLUMN customers.email2 IS 'Second contact email address';
