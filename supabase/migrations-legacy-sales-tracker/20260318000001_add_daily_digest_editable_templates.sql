-- Add Daily Digest email templates to database
-- Makes them editable from Admin Email Template Editor

-- =============================================================================
-- STEP 1: Delete existing daily digest templates (if any) to ensure clean state
-- =============================================================================

DELETE FROM email_templates
WHERE name IN (
  'Daily Digest - Has Tasks',
  'Daily Digest - No Tasks (Variation 1)',
  'Daily Digest - No Tasks (Variation 2)',
  'Daily Digest - No Tasks (Variation 3)'
);

-- =============================================================================
-- TEMPLATE 1: Daily Digest - Has Tasks
-- =============================================================================
-- This template is used when the user has tasks (overdue, today, or upcoming)
-- The code in email-templates.ts builds the task lists dynamically

INSERT INTO email_templates (
  name,
  subject,
  body,
  description,
  template_type,
  is_system,
  is_active,
  broker_id
) VALUES (
  'Daily Digest - Has Tasks',
  'Your Daily Sales Digest - {{task_summary}}',
  '<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  Here''s your task overview for today:
</p>

<div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
  <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #065f46;">
    📊 Task Summary
  </p>
  <p style="margin: 0; font-size: 14px; color: #047857;">
    You''ve got <strong>{{total_tasks}} tasks</strong> on your plate. Let''s crush them!
  </p>
</div>

<p style="margin: 24px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.6;">
  <strong>Pro Tip:</strong> Focus on overdue tasks first, then tackle today''s items. You''ve got this! 💪
</p>',
  'Email body for daily digest when user has tasks. Task lists are dynamically generated.',
  'internal',
  true,
  true,
  NULL
);


-- =============================================================================
-- TEMPLATE 2-4: Daily Digest - No Tasks (Variations to prevent email fatigue)
-- =============================================================================
-- Multiple variations randomly selected to keep emails fresh and engaging

-- Variation 1: Motivational
INSERT INTO email_templates (
  name,
  subject,
  body,
  description,
  template_type,
  is_system,
  is_active,
  broker_id
) VALUES (
  'Daily Digest - No Tasks (Variation 1)',
  'Your Pipeline is Clear 🎯',
  '<div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 24px; border-radius: 6px; margin-bottom: 32px;">
  <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">✨ All Caught Up!</p>
  <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">
    You don''t have any scheduled tasks right now. This is the perfect time to fill that pipeline and set yourself up for success!
  </p>
</div>

<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  <strong>Quick actions to keep momentum:</strong>
</p>

<ul style="margin: 0 0 32px 0; padding-left: 24px; color: #475569; font-size: 14px; line-height: 1.8;">
  <li>Schedule follow-ups with recent prospects</li>
  <li>Reach out to customers you haven''t contacted in 30+ days</li>
  <li>Review your Kanban board for stalled opportunities</li>
  <li>Set reminders for next week''s quote follow-ups</li>
</ul>',
  'Daily digest when no tasks (motivational variation)',
  'internal',
  true,
  true,
  NULL
);

-- Variation 2: Direct/Simple
INSERT INTO email_templates (
  name,
  subject,
  body,
  description,
  template_type,
  is_system,
  is_active,
  broker_id
) VALUES (
  'Daily Digest - No Tasks (Variation 2)',
  'No Tasks Scheduled Today',
  '<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
  <p style="margin: 0 0 8px 0; font-size: 17px; font-weight: 600; color: #1e3a8a;">📅 Empty Schedule</p>
  <p style="margin: 0; font-size: 15px; color: #1e40af; line-height: 1.5;">
    No tasks on your calendar today. Time to build your pipeline!
  </p>
</div>

<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  Successful brokers schedule tasks ahead of time. What customer conversations should you plan for this week?
</p>',
  'Daily digest when no tasks (simple variation)',
  'internal',
  true,
  true,
  NULL
);

-- Variation 3: Action-Focused
INSERT INTO email_templates (
  name,
  subject,
  body,
  description,
  template_type,
  is_system,
  is_active,
  broker_id
) VALUES (
  'Daily Digest - No Tasks (Variation 3)',
  'Time to Fill Your Pipeline 🚀',
  '<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 24px; border-radius: 6px; margin-bottom: 28px;">
  <p style="margin: 0 0 8px 0; font-size: 17px; font-weight: 600; color: #78350f;">⚡ Open Opportunity</p>
  <p style="margin: 0; font-size: 15px; color: #92400e; line-height: 1.5;">
    Your task list is clear. Let''s use this time to create new opportunities!
  </p>
</div>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  <strong>Today''s focus:</strong>
</p>

<ol style="margin: 0 0 28px 0; padding-left: 24px; color: #475569; font-size: 14px; line-height: 1.8;">
  <li>Check your Power Dialer for new leads needing first contact</li>
  <li>Review customers in the "Prospect" column - who''s ready to move forward?</li>
  <li>Schedule next week''s follow-up calls now</li>
</ol>

<p style="margin: 0; font-size: 14px; color: #64748b; font-style: italic; line-height: 1.5;">
  "The best time to follow up was yesterday. The second best time is now."
</p>',
  'Daily digest when no tasks (action-focused variation)',
  'internal',
  true,
  true,
  NULL
);

-- =============================================================================
-- HELPFUL NOTES FOR EDITING TEMPLATES IN ADMIN PANEL:
-- =============================================================================
-- 
-- Available Tokens (automatically replaced):
-- - {{first_name}} - User's first name
-- - {{task_summary}} - e.g., "5 Overdue" or "3 Due Today"
-- - {{total_tasks}} - Total number of tasks
-- 
-- For "Has Tasks" template:
-- - The actual task lists (overdue, today, upcoming) are dynamically generated
-- - Your template is injected between the greeting and the task lists
-- - Keep it short and motivational
-- 
-- For "No Tasks" templates:
-- - These are complete message bodies (no dynamic content added)
-- - Create 3+ variations to prevent email fatigue
-- - Names must start with "Daily Digest - No Tasks" to be found
-- 
-- The system randomly selects one "No Tasks" variation each time
-- 
-- =============================================================================
