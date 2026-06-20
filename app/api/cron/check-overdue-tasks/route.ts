import { NextResponse } from "next/server";
import { sendOverdueTaskReminders } from "@/lib/notifications-server";

/**
 * GET /api/cron/check-overdue-tasks
 * Cron endpoint to send daily reminder emails for past-due tasks
 *
 * Set up a cron job (Vercel Cron, GitHub Actions, or external service) to call this endpoint:
 * - Daily at 8 AM: Send overdue task reminders
 * - Example cron: 0 8 * * * (every day at 8:00 AM)
 *
 * Vercel Cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-overdue-tasks",
 *     "schedule": "0 8 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  try {
    // Optional: Verify this is called by a cron job (not a user)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid cron secret" },
        { status: 401 },
      );
    }

    console.log("🕐 Cron job started: Sending overdue task reminders");

    const emailsSent = await sendOverdueTaskReminders();

    return NextResponse.json({
      success: true,
      message: `Sent ${emailsSent || 0} overdue task reminder emails.`,
      emailsSent: emailsSent || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in check-overdue-tasks cron:", error);
    return NextResponse.json(
      {
        error: "Failed to check overdue tasks",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
