-- Add opportunity_type column to customers table
-- Tracks the source/origin of the customer contact

DO $$ 
BEGIN
  -- Add the opportunity_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'opportunity_type'
  ) THEN
    ALTER TABLE customers 
    ADD COLUMN opportunity_type TEXT 
    CHECK (opportunity_type IN (
      'new_call_in',
      'new_lead',
      'cold_call',
      'referral',
      'origin_destination_contact',
      'existing_customer',
      'other'
    ));

    -- Add comment for documentation
    COMMENT ON COLUMN customers.opportunity_type IS 'Source of the customer contact: new_call_in, new_lead, cold_call, referral, origin_destination_contact, existing_customer, other';
  END IF;
END $$;
