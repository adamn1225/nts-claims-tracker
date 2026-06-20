-- Add kanban_visible_fields column to user_preferences table
-- This stores which fields are visible on customer cards in the Kanban board

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS kanban_visible_fields JSONB DEFAULT '{
  "contactName": true,
  "phone": true,
  "email": true,
  "industry": false,
  "location": true,
  "links": false,
  "shippingFrequency": true,
  "lastContact": true,
  "nextFollowUp": true,
  "valueScore": false,
  "notes": false
}'::jsonb;

COMMENT ON COLUMN user_preferences.kanban_visible_fields IS 'Visibility preferences for fields on Kanban customer cards';
