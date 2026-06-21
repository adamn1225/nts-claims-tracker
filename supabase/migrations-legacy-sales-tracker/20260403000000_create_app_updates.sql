-- Create app_updates table for internal announcements/blog
CREATE TABLE IF NOT EXISTS public.app_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT DEFAULT 'general',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_app_updates_published ON app_updates(published_at DESC) WHERE is_published = true;
CREATE INDEX idx_app_updates_slug ON app_updates(slug);
CREATE INDEX idx_app_updates_category ON app_updates(category);

-- Add RLS policies
ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published updates
CREATE POLICY "Anyone can view published updates"
  ON app_updates FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage updates"
  ON app_updates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_updates_updated_at
  BEFORE UPDATE ON app_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_app_updates_updated_at();

-- Insert sample announcements
INSERT INTO app_updates (title, slug, content, excerpt, category, author_id) VALUES
(
  'Welcome to NTS Claims Tracker',
  'welcome-to-nts-claims-tracker',
  E'# Welcome to NTS Claims Tracker!\n\nWe''re excited to introduce the new Follow-Up Tracker system designed specifically for freight brokers.\n\n## Key Features\n\n- **Customer Management**: Keep track of prospects and active clients\n- **Task Scheduling**: Never miss a follow-up again\n- **Calendar Integration**: Visual timeline of your upcoming activities\n- **Contact Logging**: Complete history of every customer interaction\n\nStay tuned for more updates!',
  'Welcome to the new Follow-Up Tracker system for freight brokers.',
  'announcement',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'SSO Integration Now Live',
  'sso-integration-now-live',
  E'# Single Sign-On Integration\n\nYou can now log in seamlessly from the NTS CRM!\n\n## What This Means\n\n- No more separate logins\n- Automatic account synchronization\n- Faster access to your book of business\n\nSimply click "Sign in with NTS CRM" on the login page to get started.',
  'Single sign-on with NTS CRM is now available for seamless authentication.',
  'feature',
  (SELECT id FROM auth.users LIMIT 1)
);

COMMENT ON TABLE app_updates IS 'Internal blog/announcements for app updates and news';
