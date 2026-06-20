-- Fix user_preferences trigger to handle conflicts gracefully
-- This prevents "duplicate key" errors when retrying broker creation

-- First, check for orphaned records (auth users without broker records)
-- Run this to see if there are any problematic records:
-- SELECT u.id, u.email, b.id as broker_id, up.id as pref_id, bp.id as perm_id
-- FROM auth.users u
-- LEFT JOIN brokers b ON b.id = u.id
-- LEFT JOIN user_preferences up ON up.broker_id = u.id
-- LEFT JOIN broker_permissions bp ON bp.broker_id = u.id
-- WHERE b.id IS NULL AND (up.id IS NOT NULL OR bp.id IS NOT NULL);

-- If you find orphaned records, clean them up:
-- DELETE FROM user_preferences WHERE broker_id NOT IN (SELECT id FROM brokers);
-- DELETE FROM broker_permissions WHERE broker_id NOT IN (SELECT id FROM brokers);

-- Update the trigger function to use ON CONFLICT
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (broker_id, digest_time, email_notifications_enabled, in_app_notifications_enabled)
  VALUES (
    NEW.id,
    '08:00',
    true,
    true
  )
  ON CONFLICT (broker_id) DO NOTHING;  -- Prevent duplicate key errors
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_user_preferences IS 'Automatically creates default user preferences when a new broker is created (idempotent)';

-- Also fix broker_permissions trigger to be idempotent
CREATE OR REPLACE FUNCTION public.create_default_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.broker_permissions (
    broker_id,
    can_view_office_brokers,
    can_edit_own_customers,
    can_edit_own_tasks
  ) VALUES (
    NEW.id,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (broker_id) DO NOTHING;  -- Prevent duplicate key errors
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_default_permissions IS 'Automatically creates default permissions when a new broker is created (idempotent)';


