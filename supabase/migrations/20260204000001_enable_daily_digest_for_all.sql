-- Set default digest_time of 08:00 for all active brokers who don't have one
-- This ensures everyone gets the 8am daily email as per company policy

UPDATE user_preferences
SET digest_time = '08:00'
WHERE digest_time IS NULL
  AND broker_id IN (SELECT id FROM brokers WHERE is_active = true);
