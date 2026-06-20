-- ============================================
-- ADD DAILY DIGEST TEMPLATE (STANDALONE)
-- ============================================
-- Run this ONLY if the template doesn't exist yet
-- Check first with: SELECT * FROM email_templates WHERE name = 'Daily Digest';

-- Delete any existing Daily Digest template (if you need to recreate it)
-- DELETE FROM email_templates WHERE name = 'Daily Digest' AND is_system = true;

-- Insert the Daily Digest template
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
  'Daily Digest',
  'Your Daily Task Summary - {{date}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0065a8 0%, #265ddc 100%); padding: 40px 32px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Daily Sales Digest</h1>
      <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">{{date}}</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px 32px;">
      <p style="margin: 0 0 28px 0; font-size: 16px; color: #0f172a; font-weight: 500;">Hi {{first_name}},</p>

      {{#if has_tasks}}
      <!-- Task Summary -->
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">📊 Your Task Overview</h2>
        <div style="display: grid; gap: 12px;">
          {{#if overdue_count}}
          <div style="background-color: #fef2f2; border-left: 3px solid #dc2626; padding: 12px 16px; border-radius: 4px;">
            <span style="color: #dc2626; font-weight: 600; font-size: 14px;">{{overdue_count}} Overdue</span>
          </div>
          {{/if}}
          {{#if today_count}}
          <div style="background-color: #fffbeb; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 4px;">
            <span style="color: #f59e0b; font-weight: 600; font-size: 14px;">{{today_count}} Due Today</span>
          </div>
          {{/if}}
          {{#if upcoming_count}}
          <div style="background-color: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px 16px; border-radius: 4px;">
            <span style="color: #3b82f6; font-weight: 600; font-size: 14px;">{{upcoming_count}} Upcoming</span>
          </div>
          {{/if}}
        </div>
      </div>

      <!-- Task List -->
      {{task_list}}

      <!-- CTA -->
      <div style="text-align: center; margin-top: 40px;">
        <a href="{{app_url}}/dashboard/tasks" style="display: inline-block; background-color: #0065a8; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 101, 168, 0.2);">
          View All Tasks
        </a>
      </div>
      {{else}}
      <!-- No Tasks -->
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 24px; border-radius: 6px; margin-bottom: 32px;">
        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">{{no_tasks_title}}</p>
        <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">
          {{no_tasks_subtitle}}
        </p>
      </div>

      {{no_tasks_body}}

      <div style="text-align: center; margin-top: 40px;">
        <a href="{{app_url}}/dashboard/tasks" style="display: inline-block; background-color: #0065a8; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 101, 168, 0.2);">
          Create Your First Task
        </a>
      </div>

      <p style="margin: 40px 0 0 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
        Every task you schedule is a step toward closing more deals.
      </p>
      {{/if}}
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="{{app_url}}/dashboard/settings" style="color: #0065a8; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>',
  'Daily task digest email sent to brokers each morning. Uses {{tokens}} for dynamic content.',
  'internal',
  true,
  true,
  NULL
)
ON CONFLICT DO NOTHING; -- Prevents duplicate if it already exists

-- Verify it was added
SELECT 
  '✅ Daily Digest Template Added!' as result,
  name,
  subject,
  is_system,
  created_at
FROM email_templates
WHERE name = 'Daily Digest' AND is_system = true;
