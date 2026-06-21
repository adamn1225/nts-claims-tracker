-- Add preferred_device_id to goto_connections table
-- Stores the user's preferred device for click-to-call

ALTER TABLE public.goto_connections 
ADD COLUMN IF NOT EXISTS preferred_device_id TEXT;

COMMENT ON COLUMN public.goto_connections.preferred_device_id IS 'User preferred device ID for click-to-call (if null, uses first available device)';
