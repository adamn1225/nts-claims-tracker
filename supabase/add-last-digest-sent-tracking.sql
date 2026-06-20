-- Add last_digest_sent_date column to user_preferences table
-- This prevents sending multiple daily digest emails on the same day

ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS last_digest_sent_date DATE;

-- Add index for faster lookups when checking if digest was sent today
CREATE INDEX IF NOT EXISTS idx_user_preferences_last_digest_sent 
ON user_preferences(last_digest_sent_date);

-- Comment explaining the column
COMMENT ON COLUMN user_preferences.last_digest_sent_date IS 
'Date when the last daily digest email was sent to this user. Prevents duplicate emails on the same day.';
