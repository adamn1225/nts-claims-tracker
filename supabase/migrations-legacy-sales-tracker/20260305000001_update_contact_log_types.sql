-- ==========================================
-- UPDATE CONTACT_LOG TYPE CONSTRAINT
-- ==========================================
-- Add 'sms' and 'other' to allowed contact log types

-- Drop the old constraint
ALTER TABLE contact_log DROP CONSTRAINT IF EXISTS contact_log_type_check;

-- Add new constraint with all contact types
ALTER TABLE contact_log 
ADD CONSTRAINT contact_log_type_check 
CHECK (type IN ('call', 'email', 'meeting', 'note', 'sms', 'other', 'quote', 'shipment'));
