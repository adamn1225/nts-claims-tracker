import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/debug/check-notifications
 * Debug endpoint to check recent tasks and notifications
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("team_member_id", user.id)
      .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
      .order("created_at", { ascending: false });

    // Get recent notifications
    const { data: notifications, error: notificationsError } = await supabase
      .from("notifications")
      .select("*")
      .eq("team_member_id", user.id)
      .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
      .order("created_at", { ascending: false });

    // Get all notifications for recent tasks
    const taskIds = tasks?.map((t) => t.id) || [];
    const { data: taskNotifications, error: taskNotifError } = taskIds.length > 0
      ? await supabase
          .from("notifications")
          .select("*")
          .in("task_id", taskIds)
          .order("scheduled_for", { ascending: true })
      : { data: [], error: null };

    const now = new Date();
    const estOffset = -5 * 60; // EST is UTC-5
    const estTime = new Date(now.getTime() + estOffset * 60 * 1000);

    return NextResponse.json({
      currentTime: {
        utc: now.toISOString(),
        est: estTime.toISOString(),
        estString: estTime.toLocaleString("en-US", { timeZone: "America/New_York" }),
      },
      tasks: tasks?.map((t) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        due_time: t.due_time,
        reminder_days: t.reminder_days,
        created_at: t.created_at,
        status: t.status,
      })),
      notifications: notifications?.map((n) => ({
        id: n.id,
        task_id: n.task_id,
        title: n.title,
        message: n.message,
        scheduled_for: n.scheduled_for,
        is_read: n.is_read,
        created_at: n.created_at,
      })),
      taskNotifications: taskNotifications?.map((n) => ({
        id: n.id,
        task_id: n.task_id,
        title: n.title,
        message: n.message,
        scheduled_for: n.scheduled_for,
        is_read: n.is_read,
        created_at: n.created_at,
      })),
      errors: {
        tasks: tasksError?.message,
        notifications: notificationsError?.message,
        taskNotifications: taskNotifError?.message,
      },
      summary: {
        totalTasks: tasks?.length || 0,
        totalNotifications: notifications?.length || 0,
        notificationsForTasks: taskNotifications?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("Debug check error:", error);
    return NextResponse.json(
      {
        error: "Failed to check notifications",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
