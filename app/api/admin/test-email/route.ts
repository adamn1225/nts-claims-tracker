import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/test-email
 * Send a test email to verify email configuration
 * Admin only
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: broker } = await supabase
      .from("brokers")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!broker?.is_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { to, fromEmail, fromName } = await request.json();

    if (!to) {
      return NextResponse.json(
        { error: "Recipient email required" },
        { status: 400 },
      );
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #E85D04 0%, #FFA726 100%);
      color: #ffffff;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 20px;
    }
    .content {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #E85D04;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Test Email Successful!</h1>
  </div>
  <div class="content">
    <p><strong>Congratulations!</strong></p>
    <p>Your email configuration is working correctly. This test email was sent from the NTS Claims Tracker admin panel.</p>
    <p><strong>Configuration Details:</strong></p>
    <ul>
      <li>From: ${fromName} &lt;${fromEmail}&gt;</li>
      <li>To: ${to}</li>
      <li>Timestamp: ${new Date().toLocaleString()}</li>
    </ul>
    <p>You can now confidently send task reminders, notifications, and other emails to your brokers.</p>
  </div>
  <div class="footer">
    <p>NTS Claims Tracker - Admin Panel</p>
  </div>
</body>
</html>
    `;

    const success = await sendEmail({
      to,
      subject: "✅ Test Email from NTS Claims Tracker",
      html,
      from: {
        email:
          fromEmail ||
          process.env.SENDGRID_FROM_EMAIL ||
          "noreply@ntstransport.com",
        name: fromName || process.env.SENDGRID_FROM_NAME || "NTS Claims Tracker",
      },
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully",
        provider: "SendGrid", // TODO: Return actual provider used
      });
    } else {
      return NextResponse.json(
        { error: "Failed to send test email" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
