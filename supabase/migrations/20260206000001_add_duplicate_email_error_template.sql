-- Add email template for duplicate email error notification (MJML format)
INSERT INTO email_templates (broker_id, name, subject, body, description, template_type, is_system) VALUES
(NULL, 'Duplicate Email Error Notice', 'Important: Action Required - Email Notification Issue', 
$$<mjml>
  <mj-head>
    <mj-title>Email System Notice</mj-title>
    <mj-preview>Action may be required to continue receiving email notifications</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text color="#333333" font-size="14px" line-height="20px" />
      <mj-section padding="0px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f1f5f9">
    
    <!-- Warning Header -->
    <mj-section background-color="#fef3c7" border-left="4px solid #f59e0b" padding="20px">
      <mj-column>
        <mj-text color="#92400e" font-size="18px" font-weight="bold" padding-bottom="8px">
          ⚠️ Email System Notice
        </mj-text>
        <mj-text color="#78350f" font-size="14px">
          Action may be required to continue receiving email notifications
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Greeting -->
    <mj-section background-color="#ffffff" padding="20px 20px 10px 20px">
      <mj-column>
        <mj-text color="#334155" font-size="15px">
          Hi {{first_name}},
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Main Message -->
    <mj-section background-color="#ffffff" padding="10px 20px">
      <mj-column>
        <mj-text color="#334155" font-size="15px" line-height="24px">
          We've identified a duplicate email configuration issue that may have affected your daily digest emails. Our team has <strong>resolved the issue</strong>, and the system is now working correctly.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- What We Fixed -->
    <mj-section background-color="#f0fdf4" border-left="4px solid #10b981" padding="20px">
      <mj-column>
        <mj-text color="#065f46" font-size="15px" font-weight="600" padding-bottom="10px">
          ✅ What We Fixed:
        </mj-text>
        <mj-text color="#047857" font-size="14px" line-height="22px">
          • Removed duplicate email configuration entries<br/>
          • Updated email sending cron job to prevent duplicate sends<br/>
          • Verified all users have proper daily digest time settings
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- What You Need to Do -->
    <mj-section background-color="#eff6ff" border-left="4px solid #3b82f6" padding="20px">
      <mj-column>
        <mj-text color="#1e40af" font-size="15px" font-weight="600" padding-bottom="10px">
          📋 What You Need to Do:
        </mj-text>
        <mj-text color="#1e3a8a" font-size="14px" line-height="22px">
          <strong>1. Verify your email preferences:</strong><br/>
          <span style="color: #475569;">Check that you're receiving task notifications and daily digest emails at 8:00 AM EST</span>
        </mj-text>
        <mj-text color="#1e3a8a" font-size="14px" line-height="22px" padding-top="10px">
          <strong>2. Test the daily digest:</strong><br/>
          <span style="color: #475569;">You should receive your next daily digest tomorrow morning at 8:00 AM EST with your upcoming tasks</span>
        </mj-text>
        <mj-text color="#1e3a8a" font-size="14px" line-height="22px" padding-top="10px">
          <strong>3. Report any issues:</strong><br/>
          <span style="color: #475569;">If you don't receive your digest or notice any problems, contact your administrator</span>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Closing -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text color="#334155" font-size="15px" line-height="24px">
          If you experience any issues or have questions, please don't hesitate to reach out to your administrator or contact support.
        </mj-text>
        <mj-text color="#334155" font-size="15px" padding-top="15px">
          Thanks for your patience,
        </mj-text>
        <mj-text color="#334155" font-size="15px" font-weight="bold">
          NTS Claims Tracker Team
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer Note -->
    <mj-section background-color="#f8fafc" padding="15px 20px">
      <mj-column>
        <mj-text color="#64748b" font-size="12px" align="center">
          Questions? Reply to this email or contact your system administrator.
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>$$, 
'Notification template for duplicate email error resolution', 'internal', true)
ON CONFLICT DO NOTHING;
