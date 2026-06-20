-- Create API Tokens table for managing API access
-- Purpose: Store API keys for third-party integrations and automation
-- Scopes: Table-level CRUD permissions (e.g., customers:read, tasks:write)

CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  
  -- Token info
  name TEXT NOT NULL, -- User-friendly name (e.g., "TMS Integration", "Mobile App")
  token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the actual token
  token_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "nts_live")
  
  -- Permissions
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of permission strings
  -- Example: ["customers:read", "customers:write", "tasks:read"]
  
  -- Rate limiting
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 10000,
  requests_count INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  last_used_endpoint TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ, -- Optional expiration date
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_api_tokens_broker_id ON api_tokens(broker_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_is_active ON api_tokens(is_active) WHERE is_active = true;
CREATE INDEX idx_api_tokens_last_used_at ON api_tokens(last_used_at);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_tokens_updated_at
  BEFORE UPDATE ON api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_api_tokens_updated_at();

-- RLS Policies (only admins can manage API tokens)
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all API tokens"
  ON api_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Users can view their own tokens (but not the actual token value)
CREATE POLICY "Users can view their own API tokens"
  ON api_tokens
  FOR SELECT
  USING (broker_id = auth.uid());

-- Comment
COMMENT ON TABLE api_tokens IS 'API tokens for third-party integrations and automation scripts';
COMMENT ON COLUMN api_tokens.token_hash IS 'SHA-256 hash of the actual token (never store plaintext)';
COMMENT ON COLUMN api_tokens.token_prefix IS 'First 8 characters for display purposes (e.g., nts_live_abcd1234)';
COMMENT ON COLUMN api_tokens.scopes IS 'Array of permission strings in format "table:action" (e.g., ["customers:read", "tasks:write"])';
