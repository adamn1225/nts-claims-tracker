-- Auto-create user_preferences for all brokers who don't have them
-- This ensures everyone gets daily digest emails

-- Insert default preferences for brokers without preferences
INSERT INTO user_preferences (broker_id, digest_time, email_notifications_enabled, in_app_notifications_enabled)
SELECT 
  b.id,
  '08:00' as digest_time,  -- Default to 8 AM
  true as email_notifications_enabled,
  true as in_app_notifications_enabled
FROM brokers b
LEFT JOIN user_preferences up ON up.broker_id = b.id
WHERE up.id IS NULL  -- Only create for brokers without preferences
  AND b.is_active = true;  -- Only for active brokers

-- Create trigger to auto-create preferences when new broker is created
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (broker_id, digest_time, email_notifications_enabled, in_app_notifications_enabled)
  VALUES (
    NEW.id,
    '08:00',
    true,
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_create_user_preferences ON brokers;

-- Create trigger on broker insert
CREATE TRIGGER auto_create_user_preferences
  AFTER INSERT ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_preferences();

COMMENT ON FUNCTION create_default_user_preferences IS 'Automatically creates default user preferences when a new broker is created';
