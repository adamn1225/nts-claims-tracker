-- Add manager invite permissions to brokers table
-- can_invite_brokers: Allows manager to invite new brokers
-- can_invite_any_office: Allows manager to invite brokers to any office (overrides office restriction)

ALTER TABLE brokers 
ADD COLUMN IF NOT EXISTS can_invite_brokers BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_invite_any_office BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brokers_can_invite ON brokers(can_invite_brokers) WHERE can_invite_brokers = true;
CREATE INDEX IF NOT EXISTS idx_brokers_can_invite_any_office ON brokers(can_invite_any_office) WHERE can_invite_any_office = true;

-- Comments for documentation
COMMENT ON COLUMN brokers.can_invite_brokers IS 'Manager permission: Can invite new brokers (restricted to their office unless can_invite_any_office is true)';
COMMENT ON COLUMN brokers.can_invite_any_office IS 'Manager permission: Can invite brokers to any office location (overrides office restriction)';
