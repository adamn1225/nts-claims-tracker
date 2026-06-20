import { NextRequest, NextResponse } from "next/server";
import { generateTaskNotifications } from "@/lib/notifications-server";

/**
 * POST /api/tasks/generate-notifications
 * Generate notification records for a task based on its reminder settings
 */
export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    await generateTaskNotifications(taskId);

    return NextResponse.json({
      success: true,
      message: "Notifications generated successfully",
    });
  } catch (error: any) {
    console.error("Error generating task notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to generate notifications",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
