-- Create email_templates table for storing custom email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'external' CHECK (template_type IN ('internal', 'external')),
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_email_templates_broker_id ON email_templates(broker_id);
CREATE INDEX idx_email_templates_is_system ON email_templates(is_system);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Brokers can view system templates and their own templates
CREATE POLICY "Brokers can view system templates and their own"
  ON email_templates
  FOR SELECT
  USING (
    is_system = true OR
    broker_id = auth.uid()
  );

-- Policy: Brokers can insert their own templates
CREATE POLICY "Brokers can create their own templates"
  ON email_templates
  FOR INSERT
  WITH CHECK (broker_id = auth.uid());

-- Policy: Brokers can update their own templates
CREATE POLICY "Brokers can update their own templates"
  ON email_templates
  FOR UPDATE
  USING (broker_id = auth.uid());

-- Policy: Brokers can delete their own templates
CREATE POLICY "Brokers can delete their own templates"
  ON email_templates
  FOR DELETE
  USING (broker_id = auth.uid());

-- Insert some starter system templates
INSERT INTO email_templates (broker_id, name, subject, body, description, template_type, is_system) VALUES
(NULL, 'Prospecting Introduction', '{{first_name}}, quick intro from {{broker_name}}', 
$$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi {{first_name}},</p>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    I'm {{broker_name}} with NTS Logistics. We specialize in helping companies like {{company}} 
    move freight reliably and cost-effectively.
  </p>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    Do you have a few minutes this week to discuss your shipping lanes and see if we can help 
    optimize your transportation costs?
  </p>
  
  <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155;">Best regards,</p>
  <p style="margin: 0; font-size: 15px; color: #334155;"><strong>{{broker_name}}</strong><br/>
  {{broker_phone}}<br/>
  {{broker_email}}</p>
</div>$$, 
'First contact template for prospecting new clients', 'external', true),

(NULL, 'Follow-up After Call', 'Great talking today, {{first_name}}', 
$$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi {{first_name}},</p>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    Thanks for taking the time to speak with me earlier. Here's a quick recap of what we discussed:
  </p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #0065a8; padding: 16px; margin: 0 0 16px 0;">
    <ul style="margin: 0; padding-left: 20px; color: #475569;">
      <li style="margin-bottom: 8px;"><strong>Lanes:</strong> {{lanes}}</li>
      <li style="margin-bottom: 8px;"><strong>Frequency:</strong> {{frequency}}</li>
      <li style="margin-bottom: 0;"><strong>Next Steps:</strong> {{next_steps}}</li>
    </ul>
  </div>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    I'll send over pricing details shortly. Feel free to reach out if you have any questions in the meantime.
  </p>
  
  <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155;">Best regards,</p>
  <p style="margin: 0; font-size: 15px; color: #334155;"><strong>{{broker_name}}</strong><br/>
  {{broker_phone}}</p>
</div>$$, 
'Follow-up template after initial call with prospect', 'external', true),

(NULL, 'Re-engagement - Cold Lead', 'Still interested in freight solutions, {{first_name}}?', 
$$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi {{first_name}},</p>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    I wanted to circle back on our previous conversation about {{company}}'s shipping needs. 
    I know things get busy, so I thought I'd check in.
  </p>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    We've recently helped similar companies reduce their freight costs by 15-20% while improving 
    on-time delivery rates. Would it be worth a quick 15-minute call to explore if we can do the same for you?
  </p>
  
  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
    Let me know if now is a better time, or if I should follow up in a few months.
  </p>
  
  <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155;">Best regards,</p>
  <p style="margin: 0; font-size: 15px; color: #334155;"><strong>{{broker_name}}</strong><br/>
  {{broker_phone}}</p>
</div>$$, 
'Re-engage cold leads who haven''t responded', 'external', true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- Comment on table
COMMENT ON TABLE email_templates IS 'Stores custom email templates with token placeholders for personalization';
COMMENT ON COLUMN email_templates.broker_id IS 'NULL for system templates, user ID for user-created templates';
COMMENT ON COLUMN email_templates.template_type IS 'internal = daily digest/reminders (admin only), external = customer outreach (all users)';
COMMENT ON COLUMN email_templates.is_system IS 'System templates are available to all users and cannot be deleted';
