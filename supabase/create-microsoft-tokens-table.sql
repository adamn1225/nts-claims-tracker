-- Table to store Microsoft OAuth tokens for calendar/Teams integration
-- This is optional - users can choose whether to connect their Microsoft account

CREATE TABLE IF NOT EXISTS microsoft_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL, -- Space-separated list of granted scopes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id)
);

-- RLS Policies: Users can only access their own tokens
ALTER TABLE microsoft_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Microsoft tokens"
  ON microsoft_tokens
  FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Users can insert own Microsoft tokens"
  ON microsoft_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Users can update own Microsoft tokens"
  ON microsoft_tokens
  FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Users can delete own Microsoft tokens"
  ON microsoft_tokens
  FOR DELETE
  USING (auth.uid() = broker_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_broker_id ON microsoft_tokens(broker_id);

-- Add column to user_preferences for Microsoft integration preference
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS microsoft_integration_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE microsoft_tokens IS 'Stores Microsoft OAuth tokens for optional Calendar and Teams integration';
COMMENT ON COLUMN user_preferences.microsoft_integration_enabled IS 'Whether user wants to sync tasks to Outlook Calendar and use Teams meeting links';
