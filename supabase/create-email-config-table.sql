-- Email Configuration Table
-- Stores email provider settings for admins to manage without touching code

CREATE TABLE IF NOT EXISTS email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- General settings
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  cc_emails TEXT[], -- Array of CC email addresses
  bcc_emails TEXT[], -- Array of BCC email addresses
  
  -- Provider priority and status
  provider_priority JSONB NOT NULL DEFAULT '[
    {"id": "sendgrid", "name": "SendGrid API", "enabled": true, "priority": 1},
    {"id": "smtp", "name": "SMTP (Zoho)", "enabled": true, "priority": 2},
    {"id": "mailjet", "name": "Mailjet", "enabled": false, "priority": 3}
  ]'::jsonb,
  
  -- SendGrid configuration (encrypted)
  sendgrid_api_key TEXT, -- Encrypted
  
  -- SMTP configuration (encrypted)
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT, -- Encrypted
  smtp_secure BOOLEAN DEFAULT false,
  
  -- Mailjet configuration (encrypted)
  mailjet_api_key TEXT, -- Encrypted
  mailjet_secret_key TEXT, -- Encrypted
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Only one config row should exist (organization-wide settings)
-- Create unique constraint
CREATE UNIQUE INDEX email_config_singleton ON email_config ((true));

-- RLS policies
ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read email config
CREATE POLICY "Admins can view email config"
  ON email_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Only admins can update email config
CREATE POLICY "Admins can update email config"
  ON email_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Only admins can insert email config (should only happen once)
CREATE POLICY "Admins can insert email config"
  ON email_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_email_config_timestamp
  BEFORE UPDATE ON email_config
  FOR EACH ROW
  EXECUTE FUNCTION update_email_config_timestamp();

-- Insert default configuration using environment variables
-- This will fail if a row already exists (due to singleton constraint)
INSERT INTO email_config (
  from_email,
  from_name,
  provider_priority
) VALUES (
  'noah@nationwidetransportservices.com',
  'NTS Claims Tracker',
  '[
    {"id": "sendgrid", "name": "SendGrid API", "enabled": true, "priority": 1},
    {"id": "smtp", "name": "SMTP (Zoho)", "enabled": true, "priority": 2},
    {"id": "mailjet", "name": "Mailjet", "enabled": false, "priority": 3}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE email_config IS 'Organization-wide email configuration for admins to manage';
COMMENT ON COLUMN email_config.provider_priority IS 'JSON array defining email provider fallback order';
COMMENT ON COLUMN email_config.sendgrid_api_key IS 'Encrypted SendGrid API key';
COMMENT ON COLUMN email_config.smtp_password IS 'Encrypted SMTP password';
COMMENT ON COLUMN email_config.mailjet_api_key IS 'Encrypted Mailjet API key';
COMMENT ON COLUMN email_config.mailjet_secret_key IS 'Encrypted Mailjet secret key';
