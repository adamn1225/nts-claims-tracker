import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-service";

/**
 * TEST ENDPOINT: Send scheduled emails immediately for testing
 *
 * This bypasses the normal schedule and sends emails that would be sent
 * in the next X hours/days, allowing admins to test email delivery
 * without waiting for the actual scheduled time.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: teamMember } = await supabase
      .from("team_members")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!teamMember?.is_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { hours = 24 } = await request.json();

    // Get all tasks with follow-ups due in the next X hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() + hours);

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        due_date,
        customer_id,
        team_member_id,
        customers (
          id,
          business_name,
          contact_name,
          email
        ),
        teamMembers (
          id,
          email,
          first_name,
          last_name
        )
      `,
      )
      .lte("due_date", cutoffDate.toISOString())
      .gte("due_date", new Date().toISOString())
      .eq("completed", false);

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 },
      );
    }

    const results = {
      total: tasks?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send test emails for each task
    for (const task of tasks || []) {
      try {
        const customer = task.customers as any;
        const teamMember = task.teamMembers as any;

        if (!teamMember?.email) {
          results.failed++;
          results.errors.push(`Task ${task.id}: No team member email`);
          continue;
        }

        const emailResult = await sendEmail({
          to: teamMember.email,
          subject: `[TEST] Upcoming Task: ${task.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #E85D04; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">🧪 TEST EMAIL - Task Reminder</h1>
              </div>
              <div style="padding: 20px; background-color: #f9fafb;">
                <p><strong>This is a test email that would normally be sent on schedule.</strong></p>
                <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
                
                <h2 style="color: #1a1a1a;">Task Due Soon</h2>
                <p><strong>Task:</strong> ${task.title}</p>
                <p><strong>Due:</strong> ${new Date(task.due_date).toLocaleString()}</p>
                
                ${
                  customer
                    ? `
                  <h3 style="color: #1a1a1a; margin-top: 20px;">Customer Details</h3>
                  <p><strong>Company:</strong> ${customer.business_name}</p>
                  ${customer.contact_name ? `<p><strong>Contact:</strong> ${customer.contact_name}</p>` : ""}
                  ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ""}
                `
                    : ""
                }
                
                <div style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b;">
                  <p style="margin: 0; color: #92400e;">
                    <strong>⚠️ Test Mode:</strong> This email was sent via the admin test endpoint. 
                    In production, it would be sent automatically at the scheduled time.
                  </p>
                </div>
              </div>
              <div style="padding: 20px; background-color: #1a1a1a; color: white; text-align: center; font-size: 12px;">
                <p style="margin: 0;">NTS Claims Tracker - Test Email</p>
              </div>
            </div>
          `,
          text: `[TEST] Task Reminder: ${task.title} is due on ${new Date(task.due_date).toLocaleString()}`,
        });

        if (emailResult) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Task ${task.id}: Email send failed`);
        }
      } catch (err) {
        results.failed++;
        results.errors.push(
          `Task ${task.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Test emails sent for tasks due in next ${hours} hours`,
      results,
    });
  } catch (error) {
    console.error("Test scheduled emails error:", error);
    return NextResponse.json(
      { error: "Failed to send test emails" },
      { status: 500 },
    );
  }
}
