-- Add invite permissions to broker_permissions table
-- These were originally in the brokers table but should be in broker_permissions for consistency

ALTER TABLE broker_permissions 
ADD COLUMN IF NOT EXISTS can_invite_brokers BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_invite_any_office BOOLEAN DEFAULT FALSE;

-- Migrate existing data from brokers table if those columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokers' 
    AND column_name = 'can_invite_brokers'
  ) THEN
    UPDATE broker_permissions bp
    SET can_invite_brokers = b.can_invite_brokers
    FROM brokers b
    WHERE bp.broker_id = b.id
    AND b.can_invite_brokers IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokers' 
    AND column_name = 'can_invite_any_office'
  ) THEN
    UPDATE broker_permissions bp
    SET can_invite_any_office = b.can_invite_any_office
    FROM brokers b
    WHERE bp.broker_id = b.id
    AND b.can_invite_any_office IS NOT NULL;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN broker_permissions.can_invite_brokers IS 'Manager permission: Can invite new brokers (restricted to their office unless can_invite_any_office is true)';
COMMENT ON COLUMN broker_permissions.can_invite_any_office IS 'Manager permission: Can invite brokers to any office location (overrides office restriction)';
