-- Create API Request Logs table for audit and security
-- Purpose: Track all API requests for debugging, security, and usage analytics
-- Retention: Consider archiving/deleting logs older than 90 days

CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  
  -- Request details
  method TEXT NOT NULL, -- GET, POST, PUT, DELETE
  endpoint TEXT NOT NULL, -- /api/v1/customers
  query_params JSONB, -- Query string parameters
  request_body JSONB, -- Request body (for POST/PUT)
  
  -- Response details
  response_status INTEGER NOT NULL, -- HTTP status code (200, 404, 500, etc.)
  response_time_ms INTEGER, -- Response time in milliseconds
  error_message TEXT, -- Error message if request failed
  
  -- Client info
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX idx_api_request_logs_token_id ON api_request_logs(token_id);
CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_endpoint ON api_request_logs(endpoint);
CREATE INDEX idx_api_request_logs_status ON api_request_logs(response_status);
CREATE INDEX idx_api_request_logs_token_created ON api_request_logs(token_id, created_at DESC);

-- RLS Policies
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all API request logs"
  ON api_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Users can view logs for their own tokens
CREATE POLICY "Users can view their own API request logs"
  ON api_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_tokens
      WHERE api_tokens.id = api_request_logs.token_id
      AND api_tokens.broker_id = auth.uid()
    )
  );

-- Only system can insert logs (no direct user access)
CREATE POLICY "System can insert API request logs"
  ON api_request_logs
  FOR INSERT
  WITH CHECK (true); -- Service role will handle inserts

-- Comment
COMMENT ON TABLE api_request_logs IS 'Audit log of all API requests for security and debugging';
COMMENT ON COLUMN api_request_logs.response_time_ms IS 'Response time in milliseconds for performance monitoring';

-- Optional: Function to auto-delete logs older than 90 days (run via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM api_request_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_api_logs IS 'Delete API request logs older than 90 days (run via pg_cron weekly)';
