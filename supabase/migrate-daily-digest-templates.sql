-- Migrate hardcoded daily digest email templates to database
-- This script creates 6 system templates:
--   - 5 "no tasks" variations (randomly selected to prevent email fatigue)
--   - 1 "has tasks" template (dynamically builds task list)

-- First, delete any existing Daily Digest templates to avoid duplicates
DELETE FROM email_templates 
WHERE name LIKE 'Daily Digest%' AND is_system = true;

-- Template 1: Challenge Theme
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  is_system,
  description,
  created_at
) VALUES (
  'internal',
  'Daily Digest - No Tasks (Challenge)',
  'We Have a Challenge for You',
  '<div style="background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 6px; padding: 24px; margin-bottom: 32px;">
  <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">Your Task List is Empty</p>
  <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">Time to Fill That Pipeline</p>
</div>
<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  An empty task list means missed opportunities. Let''s change that today.
</p>
<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
  <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 17px; font-weight: 600;">Today''s Challenge: Pick One</h3>
  <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
    <li style="margin-bottom: 10px;"><strong style="color: #1e293b;">Cold Call Sprint:</strong> Make 50 calls in a 3-hour window</li>
    <li style="margin-bottom: 10px;"><strong style="color: #1e293b;">Deep Dive:</strong> 1 hour of focused prospecting calls</li>
    <li style="margin-bottom: 10px;"><strong style="color: #1e293b;">Relationship Builder:</strong> Follow up with 10 old clients</li>
    <li style="margin-bottom: 0;"><strong style="color: #1e293b;">LinkedIn Blitz:</strong> Connect with 20 industry prospects</li>
  </ul>
</div>
<p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
  <strong style="color: #334155;">Pro tip:</strong> Schedule your follow-ups before making the calls so nothing falls through the cracks.
</p>',
  true,
  'Challenge-themed motivational email when broker has no scheduled tasks',
  NOW()
);

-- Template 2: Helpful Theme
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  is_system,
  description,
  created_at
) VALUES (
  'internal',
  'Daily Digest - No Tasks (Helpful)',
  'Your Pipeline Needs Attention',
  '<div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 24px; border-radius: 6px; margin-bottom: 32px;">
  <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">No Tasks Scheduled?</p>
  <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">Let''s Build Your Book of Business</p>
</div>
<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  Successful freight brokers always have follow-ups in the pipeline. Here''s how to get started:
</p>
<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
  <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 17px; font-weight: 600;">Quick Action Ideas</h3>
  <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
    <li style="margin-bottom: 8px;">Have any old clients to follow up with?</li>
    <li style="margin-bottom: 8px;">Check LinkedIn for recent job changes in your network</li>
    <li style="margin-bottom: 8px;">Review lost opportunities - time to re-engage?</li>
    <li style="margin-bottom: 0;">Research new industries in your territory</li>
  </ul>
</div>
<p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
  <strong style="color: #334155;">Remember:</strong> One follow-up scheduled today could be a closed deal next week.
</p>',
  true,
  'Helpful-themed guidance email when broker has no scheduled tasks',
  NOW()
);

-- Template 3: Motivational Theme (Top Performers)
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  is_system,
  description,
  created_at
) VALUES (
  'internal',
  'Daily Digest - No Tasks (Motivational)',
  'Time to Take Action on Your Pipeline',
  '<div style="background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 6px; padding: 24px; margin-bottom: 32px;">
  <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">Your Task List is Clear</p>
  <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">That''s Either Great... or a Red Flag</p>
</div>
<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  No tasks means one of two things: you''re crushing it, or you need to hustle harder.
</p>
<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
  <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 17px; font-weight: 600;">What Top Performers Do Daily</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #475569; line-height: 1.6;">Schedule follow-ups immediately after every call</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #475569; line-height: 1.6;">Block time for prospecting (not "when I get around to it")</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #475569; line-height: 1.6;">Maintain a 30-60-90 day follow-up cadence</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #475569; line-height: 1.6;">Never let a prospect go cold without a task reminder</td>
    </tr>
  </table>
</div>
<p style="margin: 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6; font-style: italic;">
  "The best time to prospect was yesterday. The second best time is right now."
</p>',
  true,
  'Motivational email highlighting top performer habits when broker has no tasks',
  NOW()
);

-- Template 4: Build Mode Challenge
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  is_system,
  description,
  created_at
) VALUES (
  'internal',
  'Daily Digest - No Tasks (Build Mode)',
  'Your Book of Business: Build Mode',
  '<div style="background-color: #f8fafc; border-left: 4px solid #a855f7; border-radius: 6px; padding: 24px; margin-bottom: 32px;">
  <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">Empty Pipeline Alert</p>
  <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">Let''s Turn This Around Today</p>
</div>
<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  Your task tracker is empty, but your opportunities shouldn''t be. Here''s your game plan:
</p>
<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #a855f7; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
  <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 17px; font-weight: 600;">30-Minute Power Move</h3>
  <ol style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.8;">
    <li style="margin-bottom: 10px;"><strong style="color: #1e293b;">10 min:</strong> Pull up your CRM and identify 5 warm prospects</li>
    <li style="margin-bottom: 10px;"><strong style="color: #1e293b;">10 min:</strong> Schedule follow-up calls/emails for each one</li>
    <li style="margin-bottom: 0;"><strong style="color: #1e293b;">10 min:</strong> Add notes on what to discuss (their needs, last conversation)</li>
  </ol>
</div>
<p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 1.6;">
  <strong>Bonus Challenge:</strong> Find one prospect who went cold and schedule a "checking in" call.
</p>
<p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6; font-style: italic;">
  Consistency beats intensity. 30 minutes today = deals closed next month.
</p>',
  true,
  'Action-oriented 30-minute game plan when broker has no scheduled tasks',
  NOW()
);

-- Template 5: Competitive/Urgent Theme
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  is_system,
  description,
  created_at
) VALUES (
  'internal',
  'Daily Digest - No Tasks (Competitive)',
  'Your Competitors Are Working While You Sleep',
  '<div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 24px; border-radius: 6px; margin-bottom: 32px;">
  <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">Zero Tasks?</p>
  <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">Time for Some Honest Talk</p>
</div>
<p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
  While your task list sits empty, your competition is calling <strong>your</strong> prospects.
</p>
<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #ef4444; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
  <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 17px; font-weight: 600;">Reality Check</h3>
  <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
    <li style="margin-bottom: 8px;">That client you quoted last week? Someone else is following up.</li>
    <li style="margin-bottom: 8px;">Those LinkedIn connections? They''re getting cold.</li>
    <li style="margin-bottom: 0;">That hot lead from the trade show? They''ve moved on.</li>
  </ul>
</div>
<div style="background-color: #0f172a; color: #ffffff; padding: 20px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
  <strong style="font-size: 16px; line-height: 1.5;">Action Required: Schedule 3 Follow-Ups Right Now</strong>
</div>
<p style="margin: 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
  Winners hustle. Losers make excuses. Which one are you?
</p>',
  true,
  'Competitive/urgent motivation email when broker has no scheduled tasks',
  NOW()
);

-- Template 6: Has Tasks (Dynamic Content)
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  is_system,
  description,
  created_at
) VALUES (
  'internal',
  'Daily Digest - Has Tasks',
  'Your Daily Sales Digest - {{overdue_count}} Overdue, {{today_count}} Due Today',
  '{{overdue_section}}
{{today_section}}
{{upcoming_section}}
<p style="margin: 40px 0 0 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
  Stay organized, stay ahead. Let''s close some deals today.
</p>',
  true,
  'Dynamic task list template when broker has scheduled tasks (overdue/today/upcoming)',
  NOW()
);

-- Verification query
SELECT 
  id,
  name,
  subject,
  is_system,
  template_type,
  LENGTH(body) as html_length,
  created_at
FROM email_templates
WHERE name LIKE 'Daily Digest%'
ORDER BY name;
