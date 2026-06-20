-- Add can_access_power_dialer permission to broker_permissions table
-- This allows admins to grant Power Dialer access to specific users

-- Add column to broker_permissions table
ALTER TABLE broker_permissions 
ADD COLUMN IF NOT EXISTS can_access_power_dialer BOOLEAN DEFAULT FALSE;

-- Grant Power Dialer access to all existing admins
UPDATE broker_permissions
SET can_access_power_dialer = TRUE
WHERE broker_id IN (
  SELECT id FROM brokers WHERE is_admin = TRUE
);

-- Add comment for documentation
COMMENT ON COLUMN broker_permissions.can_access_power_dialer IS 
  'Grants access to the Power Dialer feature (requires GoTo Connect integration)';
