-- Add goto_user_email to goto_connections table
-- This stores the user's GoTo email during OAuth so we can fetch their lines/devices

ALTER TABLE public.goto_connections 
ADD COLUMN IF NOT EXISTS goto_user_email TEXT;

COMMENT ON COLUMN public.goto_connections.goto_user_email IS 'User email from GoTo OAuth (used to fetch lines via JIF API)';
