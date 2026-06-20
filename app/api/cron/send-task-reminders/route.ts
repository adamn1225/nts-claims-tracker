import { NextResponse } from "next/server";
import { sendUpcomingTaskReminders } from "@/lib/notifications-server";

/**
 * GET/POST /api/cron/send-task-reminders
 * Cron endpoint to send email reminders for upcoming tasks
 *
 * Called by pg_cron every 10 minutes via POST
 * Can also be called manually via GET for testing
 *
 * This checks for tasks with time-based reminders (15 min, 30 min, 1 hour before, etc.)
 * and sends email notifications when the reminder time is reached
 */

async function handleRequest(request: Request) {
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

    console.log("📬 Cron job started: Sending task reminders");

    const emailsSent = await sendUpcomingTaskReminders();

    return NextResponse.json({
      success: true,
      message: `Sent ${emailsSent || 0} task reminder emails`,
      emailsSent: emailsSent || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in send-task-reminders cron:", error);
    return NextResponse.json(
      {
        error: "Failed to send task reminders",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

// Support both GET (manual testing) and POST (pg_cron calls)
export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}
