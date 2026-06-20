/**
 * Email template for daily task digest
 * Consolidated view of all tasks instead of spamming individual emails
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Create a service-role Supabase client (bypasses RLS)
 */
function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface DigestTask {
  id: string;
  title: string;
  description?: string | null;
  due_date: string;
  due_time?: string | null;
  priority?: string | null;
  type: string;
  customer?: {
    business_name: string;
    contact_name?: string;
  } | null;
}

interface DailyDigestData {
  overdueTasks: DigestTask[];
  todayTasks: DigestTask[];
  upcomingTasks: DigestTask[];
}

const priorityConfig: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  urgent: { emoji: "🚨", label: "URGENT", color: "#265ddc" },
  high: { emoji: "🔴", label: "HIGH", color: "#ea580c" },
  medium: { emoji: "🟡", label: "MEDIUM", color: "#f59e0b" },
  low: { emoji: "🔵", label: "LOW", color: "#3b82f6" },
};

/**
 * Fetch "no tasks" templates from database (randomly select one)
 */
async function getRandomNoTasksTemplate(): Promise<{
  subject: string;
  body: string;
} | null> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("email_templates")
      .select("subject, body")
      .like("name", "Daily Digest - No Tasks%")
      .eq("is_system", true);

    if (error || !data || data.length === 0) {
      console.error("Failed to fetch no-tasks templates:", error);
      return null;
    }

    // Randomly select one template to prevent email fatigue
    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  } catch (err) {
    console.error("Error fetching no-tasks templates:", err);
    return null;
  }
}

/**
 * Fetch "has tasks" template from database
 */
async function getHasTasksTemplate(): Promise<{
  subject: string;
  body: string;
} | null> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("name", "Daily Digest - Has Tasks")
      .eq("is_system", true)
      .single();

    if (error || !data) {
      console.error("Failed to fetch has-tasks template:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching has-tasks template:", err);
    return null;
  }
}

function formatTaskForEmail(task: DigestTask, daysOverdue?: number): string {
  const priority = priorityConfig[task.priority || "medium"];
  const customerInfo = task.customer ? ` - ${task.customer.business_name}` : "";
  const overdueText = daysOverdue ? ` (${daysOverdue}d overdue)` : "";
  const timeText = task.due_time
    ? ` at ${new Date(`2000-01-01T${task.due_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "";

  return `${priority.emoji} <strong style="color: ${priority.color}">${priority.label}:</strong> ${task.title}${customerInfo}${timeText}${overdueText}`;
}

export async function generateDailyDigestHTML(
  firstName: string,
  data: DailyDigestData,
  appUrl: string,
): Promise<{ html: string; subject: string }> {
  const { overdueTasks, todayTasks, upcomingTasks } = data;
  const totalTasks =
    overdueTasks.length + todayTasks.length + upcomingTasks.length;

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Calculate days overdue
  const getTasksWithOverdueDays = (tasks: DigestTask[]) =>
    tasks.map((task) => {
      const taskDate = new Date(task.due_date);
      if (task.due_time) {
        const [hours, minutes] = task.due_time.split(":");
        taskDate.setHours(parseInt(hours), parseInt(minutes));
      }
      const daysOverdue = Math.floor(
        (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { task, daysOverdue: Math.max(1, daysOverdue) };
    });

  const overdueWithDays = getTasksWithOverdueDays(overdueTasks);

  // Determine task summary for subject line
  const taskSummary =
    overdueTasks.length > 0
      ? `${overdueTasks.length} Overdue`
      : todayTasks.length > 0
        ? `${todayTasks.length} Due Today`
        : `${upcomingTasks.length} Upcoming`;

  // No tasks at all - fetch and randomly select a variation to prevent email fatigue
  if (totalTasks === 0) {
    const template = await getRandomNoTasksTemplate();
    
    if (!template) {
      // Fallback to simple message if templates not available
      return {
        subject: "No Tasks Scheduled Today",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0065a8 0%, #265ddc 100%); padding: 40px 32px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Daily Sales Digest</h1>
      <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px 32px;">
      <p style="margin: 0 0 28px 0; font-size: 16px; color: #0f172a; font-weight: 500;">Hi ${firstName},</p>

      <!-- Fallback message if templates unavailable -->
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
        You don't have any tasks scheduled. Time to fill that pipeline!
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 40px;">
        <a href="${appUrl}/dashboard/tasks" style="display: inline-block; background-color: #0065a8; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 101, 168, 0.2);">
          Create Your First Task
        </a>
      </div>

      <p style="margin: 40px 0 0 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
        Every task you schedule is a step toward closing more deals.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="${appUrl}/dashboard/settings" style="color: #0065a8; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>
        `,
      };
    }

    // Template found - use it with token replacements
    const processedSubject = template.subject
      .replaceAll("{{first_name}}", firstName)
      .replaceAll("{{date}}", now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));

    const processedBody = template.body
      .replaceAll("{{first_name}}", firstName)
      .replaceAll("{{app_url}}", appUrl);

    return {
      subject: processedSubject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0065a8 0%, #265ddc 100%); padding: 40px 32px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Daily Sales Digest</h1>
      <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px 32px;">
      <p style="margin: 0 0 28px 0; font-size: 16px; color: #0f172a; font-weight: 500;">Hi ${firstName},</p>

      ${processedBody}

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 40px;">
        <a href="${appUrl}/dashboard/tasks" style="display: inline-block; background-color: #0065a8; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 101, 168, 0.2);">
          Create Your First Task
        </a>
      </div>

      <p style="margin: 40px 0 0 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
        Every task you schedule is a step toward closing more deals.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="${appUrl}/dashboard/settings" style="color: #0065a8; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>
      `,
    };
  }

  // Has tasks - fetch template from database
  const hasTasksTemplate = await getHasTasksTemplate();
  
  // Build dynamic task list HTML (this is always generated, regardless of template)
  const taskListsHtml = `
      ${
        overdueTasks.length > 0
          ? `
      <!-- Overdue Tasks -->
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #991b1b; letter-spacing: -0.3px;">OVERDUE TASKS (${overdueTasks.length})</h2>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${overdueWithDays.map(({ task, daysOverdue }) => `<li style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #7f1d1d;">${formatTaskForEmail(task, daysOverdue)}</li>`).join("")}
        </ul>
      </div>
      `
          : ""
      }

      ${
        todayTasks.length > 0
          ? `
      <!-- Today's Tasks -->
      <div style="background-color: #fefce8; border-left: 4px solid #f59e0b; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #92400e; letter-spacing: -0.3px;">DUE TODAY (${todayTasks.length})</h2>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${todayTasks.map((task) => `<li style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #78350f;">${formatTaskForEmail(task)}</li>`).join("")}
        </ul>
      </div>
      `
          : ""
      }

      ${
        upcomingTasks.length > 0
          ? `
      <!-- Upcoming Tasks -->
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #1e40af; letter-spacing: -0.3px;">UPCOMING THIS WEEK (${upcomingTasks.length})</h2>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${upcomingTasks
            .map((task) => {
              const taskDate = new Date(task.due_date);
              const dateStr = taskDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return `<li style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #1e3a8a;">${formatTaskForEmail(task)} <span style="color: #64748b;">(${dateStr})</span></li>`;
            })
            .join("")}
        </ul>
      </div>
      `
          : ""
      }
  `;

  // Use template from database if available, otherwise use default intro text
  const introHtml = hasTasksTemplate
    ? hasTasksTemplate.body
        .replaceAll("{{first_name}}", firstName)
        .replaceAll("{{task_summary}}", taskSummary)
        .replaceAll("{{total_tasks}}", totalTasks.toString())
    : `<p style="margin: 0 0 32px 0; font-size: 15px; color: #64748b;">Here's your task overview for today:</p>`;

  // Determine subject line - use template if available
  const emailSubject = hasTasksTemplate
    ? hasTasksTemplate.subject
        .replaceAll("{{first_name}}", firstName)
        .replaceAll("{{task_summary}}", taskSummary)
        .replaceAll("{{total_tasks}}", totalTasks.toString())
    : `Your Daily Sales Digest - ${taskSummary}`;

  // Build complete email
  return {
    subject: emailSubject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0065a8 0%, #265ddc 100%); padding: 40px 32px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Daily Sales Digest</h1>
      <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px 32px;">
      <p style="margin: 0 0 28px 0; font-size: 16px; color: #0f172a; font-weight: 500;">Hi ${firstName},</p>

      ${introHtml}

      ${taskListsHtml}

      <div style="text-align: center; margin-top: 40px;">
        <a href="${appUrl}/dashboard/tasks" style="display: inline-block; background-color: #0065a8; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 101, 168, 0.2);">
          View All Tasks
        </a>
      </div>

      <p style="margin: 40px 0 0 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
        Stay organized, stay ahead. Let's close some deals today.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="${appUrl}/dashboard/settings" style="color: #0065a8; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>
    `,
  };
}

/**
 * Generate email for contact assignment notification
 */
export function generateContactAssignedEmail(
  firstName: string,
  contactName: string,
  assignedBy: string,
  appUrl: string,
): { html: string; subject: string } {
  return {
    subject: `New Contact Assigned: ${contactName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #E85D04 0%, #D84D00 100%); padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        🎯 New Contact Assigned
      </h1>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${firstName}</strong>,
      </p>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; color: #92400e; line-height: 1.6;">
          <strong style="color: #78350f;">New Lead Alert!</strong><br/>
          ${assignedBy} has assigned <strong>${contactName}</strong> to you.
        </p>
      </div>

      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        This contact is now in your book of business. Follow up promptly to maximize your chances of converting them into an active customer.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">Next Steps:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
          <li style="margin-bottom: 8px;">Review the contact's details and notes</li>
          <li style="margin-bottom: 8px;">Schedule a follow-up task or call</li>
          <li style="margin-bottom: 0;">Start building the relationship!</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #E85D04; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(232, 93, 4, 0.3);">
          View Contact in Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="${appUrl}/dashboard/settings" style="color: #E85D04; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>
    `,
  };
}

/**
 * Generate email for batch contact assignment notification
 */
export function generateBatchContactAssignedEmail(
  firstName: string,
  count: number,
  assignedBy: string,
  appUrl: string,
): { html: string; subject: string } {
  return {
    subject: `${count} New Contacts Assigned to You`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #E85D04 0%, #D84D00 100%); padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        🎯 ${count} New Contacts Assigned
      </h1>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${firstName}</strong>,
      </p>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; color: #92400e; line-height: 1.6;">
          <strong style="color: #78350f;">Multiple Leads Assigned!</strong><br/>
          ${assignedBy} has assigned <strong>${count} contacts</strong> to your book of business.
        </p>
      </div>

      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        These contacts are now in your pipeline. Review them in the dashboard and start building relationships to convert them into active customers.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">Recommended Action Plan:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
          <li style="margin-bottom: 8px;">Prioritize contacts based on potential value</li>
          <li style="margin-bottom: 8px;">Schedule follow-up tasks for each contact</li>
          <li style="margin-bottom: 8px;">Review any existing notes or interaction history</li>
          <li style="margin-bottom: 0;">Start outreach within 24-48 hours</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #E85D04; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(232, 93, 4, 0.3);">
          View Contacts in Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="${appUrl}/dashboard/settings" style="color: #E85D04; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>
    `,
  };
}

/**
 * Generate email for contact reassignment notification
 */
export function generateContactReassignedEmail(
  firstName: string,
  contactName: string,
  reassignedBy: string,
  appUrl: string,
): { html: string; subject: string } {
  return {
    subject: `Contact Reassigned: ${contactName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        🔄 Contact Reassigned to You
      </h1>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${firstName}</strong>,
      </p>

      <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; color: #1e3a8a; line-height: 1.6;">
          <strong style="color: #1e40af;">Contact Transfer</strong><br/>
          ${reassignedBy} has reassigned <strong>${contactName}</strong> to you.
        </p>
      </div>

      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        This contact has been transferred to your book of business. Review their history and continue building the relationship.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">Action Items:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
          <li style="margin-bottom: 8px;">Review previous interaction history and notes</li>
          <li style="margin-bottom: 8px;">Contact them to introduce yourself</li>
          <li style="margin-bottom: 0;">Set up your follow-up schedule</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
          View Contact Details
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
        NTS Claims Tracker | <a href="${appUrl}/dashboard/settings" style="color: #3b82f6; text-decoration: none; font-weight: 500;">Manage Preferences</a>
      </p>
    </div>

  </div>
</body>
</html>
    `,
  };
}
