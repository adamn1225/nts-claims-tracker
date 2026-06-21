-- Create task templates table for reusable task patterns
-- This allows brokers to save frequently used task configurations as templates

CREATE TABLE task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES brokers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  
  -- Task configuration fields (same as tasks table)
  type text NOT NULL,
  priority text,
  reminder_days integer[],
  
  -- Default due date offset (e.g., "+1 day", "+1 week")
  due_date_offset text DEFAULT '+1 day',
  due_time text,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT task_templates_broker_id_name_key UNIQUE(broker_id, name)
);

-- Add RLS policies
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- Brokers can only see their own templates
CREATE POLICY "Brokers can view own templates"
  ON task_templates
  FOR SELECT
  USING (broker_id = auth.uid());

-- Brokers can insert their own templates
CREATE POLICY "Brokers can create own templates"
  ON task_templates
  FOR INSERT
  WITH CHECK (broker_id = auth.uid());

-- Brokers can update their own templates
CREATE POLICY "Brokers can update own templates"
  ON task_templates
  FOR UPDATE
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

-- Brokers can delete their own templates
CREATE POLICY "Brokers can delete own templates"
  ON task_templates
  FOR DELETE
  USING (broker_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_task_templates_broker_id ON task_templates(broker_id);

COMMENT ON TABLE task_templates IS 'Reusable task templates for brokers to quickly create common tasks';
COMMENT ON COLUMN task_templates.due_date_offset IS 'Relative offset for due date (e.g., "+1 day", "+3 days", "+1 week")';
