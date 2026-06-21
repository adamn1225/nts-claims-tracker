-- Add numeric_account_key to goto_connections
-- This stores the legacy numeric accountKey (e.g. "8778469392336402103") returned by
-- api.getgo.com/admin/rest/v1/me — required by call-history/v1/calls and the
-- legacy admin users API. Distinct from account_key which is the UUID (ls JWT claim).
ALTER TABLE public.goto_connections
  ADD COLUMN IF NOT EXISTS numeric_account_key TEXT;

COMMENT ON COLUMN public.goto_connections.numeric_account_key IS
  'Numeric GoTo accountKey from legacy /admin/rest/v1/me — required for call-history API';
