-- Add new feature access permissions to broker_permissions table
-- Migration: Add web search and team management permissions

ALTER TABLE broker_permissions
ADD COLUMN IF NOT EXISTS can_use_web_search BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE broker_permissions
ADD COLUMN IF NOT EXISTS can_manage_team BOOLEAN NOT NULL DEFAULT false;

-- Grant managers team management by default
UPDATE broker_permissions
SET can_manage_team = true
WHERE broker_id IN (
  SELECT id FROM brokers WHERE is_manager = true OR is_admin = true
);

-- Add comment explaining the permissions
COMMENT ON COLUMN broker_permissions.can_use_web_search IS 'Allow broker to use Tavily AI web search for customer research ($0.008/search, 1000/month free tier)';
COMMENT ON COLUMN broker_permissions.can_manage_team IS 'Allow broker to reassign customers and view team analytics';
