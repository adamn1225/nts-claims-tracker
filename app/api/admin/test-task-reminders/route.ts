import { NextRequest, NextResponse } from "next/server";
import { notifyTasksDueSoon } from "@/lib/tasks/notifications";

/**
 * GET /api/admin/test-task-reminders?userId=xxx
 *
 * Safe test endpoint that runs the due-soon notifier scoped to a single
 * user, so we can verify the email + in-app flow without touching everyone
 * else's inbox. Under the current claim-native schema there is no per-task
 * `reminder_days` config, so the "diagnostic" branch the legacy endpoint
 * exposed no longer has an equivalent and is removed here.
 */
export async function GET(request: NextRequest) {
  try {
    const userId =
      request.nextUrl.searchParams.get("userId") ??
      request.nextUrl.searchParams.get("teamMemberId");

    if (!userId) {
      return NextResponse.json(
        {
          error: "Missing userId parameter",
          usage: "/api/admin/test-task-reminders?userId=YOUR_USER_ID",
        },
        { status: 400 },
      );
    }

    const emailsSent = await notifyTasksDueSoon(userId);

    return NextResponse.json({
      success: true,
      mode: "TEST MODE (scoped to the provided userId)",
      userId,
      emailsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in test-task-reminders:", error);
    return NextResponse.json(
      {
        error: "Failed to test task reminders",
        message,
      },
      { status: 500 },
    );
  }
}
