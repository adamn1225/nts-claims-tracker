-- Lane Launchpad saved templates
-- Stores per-user lane + load configurations so brokers can quickly re-run common lanes

CREATE TABLE lane_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  name text NOT NULL,

  -- Route
  origin_zip text NOT NULL,
  destination_zip text NOT NULL,

  -- Load profile
  trailer_id text NOT NULL,
  length_ft numeric NOT NULL DEFAULT 0,
  width_ft numeric NOT NULL DEFAULT 0,
  height_ft numeric NOT NULL DEFAULT 0,
  weight_lbs numeric NOT NULL DEFAULT 0,
  make_model text,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lane_templates_broker_name_key UNIQUE (broker_id, name)
);

ALTER TABLE lane_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view own lane templates"
  ON lane_templates FOR SELECT
  USING (broker_id = auth.uid());

CREATE POLICY "Brokers can create own lane templates"
  ON lane_templates FOR INSERT
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can update own lane templates"
  ON lane_templates FOR UPDATE
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can delete own lane templates"
  ON lane_templates FOR DELETE
  USING (broker_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lane_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lane_templates_updated_at
  BEFORE UPDATE ON lane_templates
  FOR EACH ROW EXECUTE FUNCTION update_lane_templates_updated_at();
