-- Add template_type column to existing email_templates table
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'external' CHECK (template_type IN ('internal', 'external'));

-- Update existing system templates to be 'external' type
UPDATE email_templates 
SET template_type = 'external' 
WHERE is_system = true AND template_type IS NULL;

-- Update existing user templates to be 'external' type (default)
UPDATE email_templates 
SET template_type = 'external' 
WHERE template_type IS NULL;

-- Update table comment to include template_type
COMMENT ON COLUMN email_templates.template_type IS 'internal = daily digest/reminders (admin only), external = customer outreach (all users)';
