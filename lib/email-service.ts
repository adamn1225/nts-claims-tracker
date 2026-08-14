/**
 * Email Service - Centralized email sending using SendGrid
 * Handles all email notifications for the NTS Claims Tracker
 *
 * @packageDocumentation
 * @server-only This module can only be used on the server side
 */

import "server-only";
import { getEmailConfig } from "./email-config";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    email: string;
    name: string;
  };
}

interface TaskReminderData {
  taskTitle: string;
  taskDescription?: string;
  dueDate: string;
  dueTime?: string;
  customerName?: string;
  taskUrl: string;
  priority?: "urgent" | "high" | "medium" | "low";
}

interface NotificationEmailData {
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  priority?: "urgent" | "high" | "medium" | "low";
}

/**
 * Send an email using configured providers with fallback
 * Reads configuration from database (email_config table)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = await getEmailConfig();

  const from = options.from || {
    email: config.from_email,
    name: config.from_name,
  };

  // Get enabled providers sorted by priority
  const enabledProviders = config.provider_priority
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);

  // Try each provider in order
  for (const provider of enabledProviders) {
    try {
      if (provider.id === "sendgrid" && config.sendgrid_api_key) {
        console.log(
          `📤 Attempting to send email via ${provider.name} to:`,
          options.to,
        );

        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.sendgrid_api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: options.to }],
                subject: options.subject,
              },
            ],
            from: {
              email: from.email,
              name: from.name,
            },
            content: [
              // SendGrid requires text/plain first, then text/html
              ...(options.text
                ? [
                  {
                    type: "text/plain",
                    value: options.text,
                  },
                ]
                : []),
              {
                type: "text/html",
                value: options.html,
              },
            ],
          }),
        });

        if (response.ok) {
          console.log(`✅ Email sent successfully via ${provider.name}`);
          return true;
        } else {
          const errorText = await response.text();
          console.error(`${provider.name} failed:`, response.status, errorText);
          throw new Error(`${provider.name} failed: ${response.status}`);
        }
      }
    } catch (error) {
      console.error(`❌ ${provider.name} error:`, error);
      // Continue to next provider
    }
  }

  // Log why all providers failed
  console.error("❌ All email providers failed. Config check:");
  console.error(
    `  - SendGrid API key: ${config.sendgrid_api_key ? "Set (length: " + config.sendgrid_api_key.length + ")" : "MISSING"}`,
  );
  console.error(
    `  - Enabled providers: ${enabledProviders.map((p) => p.id).join(", ")}`,
  );
  return false;
}

/**
 * Send a task reminder email to a user
 */
export async function sendTaskReminderEmail(
  recipientEmail: string,
  recipientName: string,
  data: TaskReminderData,
): Promise<boolean> {
  const {
    taskTitle,
    taskDescription,
    dueDate,
    dueTime,
    customerName,
    taskUrl,
    priority,
  } = data;

  const formattedDate = new Date(dueDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const priorityConfig: Record<
    string,
    { bg: string; text: string; label: string; icon: string }
  > = {
    urgent: {
      bg: "#dc2626",
      text: "#ffffff",
      label: "URGENT",
      icon: "🚨",
    },
    high: { bg: "#ea580c", text: "#ffffff", label: "HIGH", icon: "⚠️" },
    medium: {
      bg: "#f59e0b",
      text: "#ffffff",
      label: "MEDIUM",
      icon: "📌",
    },
    low: { bg: "#3b82f6", text: "#ffffff", label: "LOW", icon: "ℹ️" },
  };

  const priorityStyle = priorityConfig[priority || "medium"];
  const subjectPrefix = priority
    ? `${priorityStyle.icon} ${priorityStyle.label}: `
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #E85D04 0%, #FFA726 100%);
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .task-card {
      background: #f8f9fa;
      border-left: 4px solid ${priorityStyle.bg};
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .priority-badge {
      display: inline-block;
      background: ${priorityStyle.bg};
      color: ${priorityStyle.text};
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .task-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 10px 0;
    }
    .task-meta {
      font-size: 14px;
      color: #666;
      margin: 5px 0;
    }
    .task-meta strong {
      color: #333;
    }
    .cta-button {
      display: inline-block;
      background: #E85D04;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .cta-button:hover {
      background: #d14d00;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Task Reminder</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p>This is a friendly reminder about an upcoming task:</p>
      
      <div class="task-card">
        ${priority ? `<div class="priority-badge">${priorityStyle.icon} ${priorityStyle.label} PRIORITY</div>` : ""}
        <div class="task-title">${taskTitle}</div>
        ${taskDescription ? `<p style="margin: 10px 0; color: #555;">${taskDescription}</p>` : ""}
        <div class="task-meta">
          <strong>Due:</strong> ${formattedDate}${dueTime ? ` at ${dueTime}` : ""}
        </div>
        ${customerName ? `<div class="task-meta"><strong>Customer:</strong> ${customerName}</div>` : ""}
      </div>

      <center>
        <a href="${taskUrl}" class="cta-button">View Task Details</a>
      </center>

      <p style="margin-top: 30px; color: #fff; font-size: 14px;">
        Manage your notification preferences in your 
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings" style="color: #E85D04;">account settings</a>.
      </p>
    </div>
    <div class="footer">
      <p>NTS Claims Tracker - Nationwide Transport Services</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Task Reminder

Hi ${recipientName},

This is a reminder about an upcoming task:

${taskTitle}
${taskDescription ? `\n${taskDescription}\n` : ""}
Due: ${formattedDate}${dueTime ? ` at ${dueTime}` : ""}
${customerName ? `Customer: ${customerName}` : ""}

View task: ${taskUrl}

Manage notification preferences: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `${subjectPrefix}Task Reminder: ${taskTitle}`,
    html,
    text,
  });
}

/**
 * Send a general notification email to a user
 */
export async function sendNotificationEmail(
  recipientEmail: string,
  recipientName: string,
  data: NotificationEmailData,
): Promise<boolean> {
  const { title, message, actionText, actionUrl, priority } = data;

  const priorityColors: Record<
    string,
    { bg: string; text: string; icon: string }
  > = {
    urgent: { bg: "#dc2626", text: "#ffffff", icon: "🚨" },
    high: { bg: "#ea580c", text: "#ffffff", icon: "⚠️" },
    medium: { bg: "#f59e0b", text: "#ffffff", icon: "📌" },
    low: { bg: "#3b82f6", text: "#ffffff", icon: "ℹ️" },
  };

  const priorityStyle = priorityColors[priority || "medium"];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: ${priorityStyle.bg};
      color: ${priorityStyle.text};
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .message-box {
      background: #f8f9fa;
      border-left: 4px solid ${priorityStyle.bg};
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .cta-button {
      display: inline-block;
      background: #E85D04;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${priorityStyle.icon} ${title}</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      
      <div class="message-box">
        ${message}
      </div>

      ${actionUrl && actionText ? `<center><a href="${actionUrl}" class="cta-button">${actionText}</a></center>` : ""}

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        Manage your notification preferences in your 
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings" style="color: #E85D04;">account settings</a>.
      </p>
    </div>
    <div class="footer">
      <p>NTS Claims Tracker - Nationwide Transport Services</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${title}

Hi ${recipientName},

${message}

${actionUrl && actionText ? `${actionText}: ${actionUrl}` : ""}

Manage notification preferences: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings
  `;

  return sendEmail({
    to: recipientEmail,
    subject: title,
    html,
    text,
  });
}

/**
 * Send a welcome email to a new user
 */
export async function sendWelcomeEmail(
  recipientEmail: string,
  recipientName: string,
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #E85D04 0%, #FFA726 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
    }
    .content {
      padding: 30px 20px;
    }
    .feature {
      margin: 15px 0;
      padding-left: 30px;
      position: relative;
    }
    .feature:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
      font-size: 18px;
    }
    .cta-button {
      display: inline-block;
      background: #E85D04;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 40px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to NTS Claims Tracker!</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p>Welcome to NTS Claims Tracker! We're excited to have you on board.</p>
      
      <h3 style="color: #1a1a1a; margin-top: 30px;">Here's what you can do:</h3>
      
      <div class="feature">Track your book of business with visual Kanban boards</div>
      <div class="feature">Never miss a follow-up with calendar reminders</div>
      <div class="feature">Manage tasks and customer interactions</div>
      <div class="feature">Access your pipeline from anywhere, on any device</div>

      <center>
        <a href="${appUrl}/dashboard" class="cta-button">Go to Dashboard</a>
      </center>

      <p style="margin-top: 30px;">
        <strong>Need help getting started?</strong><br>
        Visit your <a href="${appUrl}/dashboard/settings" style="color: #E85D04;">settings page</a> to customize your experience and set up email notifications.
      </p>
    </div>
    <div class="footer">
      <p>NTS Claims Tracker - Nationwide Transport Services</p>
      <p>Questions? Contact your admin or team leader.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: "Welcome to NTS Claims Tracker!",
    html,
  });
}
