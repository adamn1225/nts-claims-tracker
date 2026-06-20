-- Add imports table column preferences to user_preferences
-- This allows users to save their column order and visibility settings

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS imports_column_order jsonb DEFAULT '["businessName","contactName","phone","email","industry","location","links","source","dispatches","valueScore","added"]'::jsonb,
ADD COLUMN IF NOT EXISTS imports_visible_columns jsonb DEFAULT '{"businessName":true,"contactName":true,"phone":true,"email":true,"industry":true,"location":true,"links":true,"source":true,"dispatches":true,"valueScore":true,"added":true}'::jsonb;

-- Comment explaining the fields
COMMENT ON COLUMN user_preferences.imports_column_order IS 'Array of column keys defining the order of columns in the imports table';
COMMENT ON COLUMN user_preferences.imports_visible_columns IS 'Object mapping column keys to boolean visibility state';
