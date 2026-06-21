-- App-wide settings (singleton row) for site maintenance mode.
--
-- Drives:
--   * The full-screen maintenance page shown to non-admin users when
--     maintenance_enabled is true.
--   * The dismissible advance-warning countdown banner (when maintenance is
--     scheduled via maintenance_starts_at but not yet enabled).
--   * The "expected back" countdown shown to waiting users (maintenance_ends_at).
--
-- The table is intentionally a single row, enforced by a fixed boolean PK.

CREATE TABLE IF NOT EXISTS app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text,
  maintenance_starts_at timestamptz,
  maintenance_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES brokers(id) ON DELETE SET NULL,
  -- Enforce a single row: id can only ever be `true`.
  CONSTRAINT app_settings_singleton CHECK (id)
);

-- Seed the singleton row.
INSERT INTO app_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security: everyone signed in can read the maintenance state;
-- only admins may change it. (API routes use the service role and bypass RLS,
-- but these policies protect any direct client access.)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select_all ON app_settings;
CREATE POLICY app_settings_select_all
  ON app_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS app_settings_admin_write ON app_settings;
CREATE POLICY app_settings_admin_write
  ON app_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = auth.uid() AND b.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = auth.uid() AND b.is_admin = true
    )
  );

COMMENT ON TABLE app_settings IS
  'Singleton app-wide settings, including site maintenance mode.';
