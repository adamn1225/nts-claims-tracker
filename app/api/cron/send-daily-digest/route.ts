import { NextResponse } from "next/server";
import { sendDailyDigestEmails } from "@/lib/notifications-server";

/**
 * GET/POST /api/cron/send-daily-digest
 * Cron endpoint to send daily digest emails to ALL users
 *
 * Sends consolidated task overview instead of spamming individual overdue emails
 * Encourages task creation if user has no tasks
 *
 * Called by pg_cron every 10 minutes via POST
 * Can also be called manually via GET for testing
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

    console.log("🕐 Cron job started: Sending daily digest emails");

    const emailsSent = await sendDailyDigestEmails();

    return NextResponse.json({
      success: true,
      message: `Sent ${emailsSent || 0} daily digest emails.`,
      emailsSent: emailsSent || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in send-daily-digest cron:", error);
    return NextResponse.json(
      {
        error: "Failed to send daily digest",
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
