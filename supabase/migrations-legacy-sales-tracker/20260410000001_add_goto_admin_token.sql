-- Add is_admin_token flag to goto_connections so the admin's GoTo credentials
-- can be used as a fallback for brokers who haven't connected GoTo individually.
-- Also adds a goto_user_key column to cache the GoTo platform user ID per connection
-- (needed to fetch call history on behalf of a specific user via the admin token).

ALTER TABLE goto_connections
  ADD COLUMN IF NOT EXISTS is_admin_token boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goto_user_key text;

-- Index: quick lookup of the single admin token row
CREATE INDEX IF NOT EXISTS idx_goto_connections_admin_token
  ON goto_connections (is_admin_token)
  WHERE is_admin_token = true;

COMMENT ON COLUMN goto_connections.is_admin_token IS
  'When true, this row holds the GoTo org-admin OAuth credentials. Used as a '
  'fallback to pull call history for brokers who have not individually connected GoTo.';

COMMENT ON COLUMN goto_connections.goto_user_key IS
  'The GoTo platform internal user key (e.g. "4325746367515308727"). '
  'Populated from /admin/v1/users or the IAM /ext-admin/rest/me endpoint. '
  'Used to scope call-history and voicemail lookups to a specific broker.';
