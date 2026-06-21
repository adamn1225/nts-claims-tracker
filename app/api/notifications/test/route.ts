import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOverdueNotifications } from "@/lib/notifications";

/**
 * POST /api/notifications/test
 * Manually trigger overdue task notifications for testing
 * This will check for overdue tasks and send both in-app and email notifications
 */
export async function POST(request: Request) {
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

    console.log("🧪 Testing notifications for user:", user.id);

    // Trigger overdue notification generation
    await generateOverdueNotifications(user.id);

    // Get stats on what was created
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, due_date")
      .eq("team_member_id", user.id)
      .in("status", ["overdue", "pending"]);

    const overdueCount =
      tasks?.filter((t) => t.status === "overdue").length || 0;
    const totalTasks = tasks?.length || 0;

    let emailResult = null;

    // Send email notifications for overdue tasks
    if (overdueCount > 0) {
      try {
        const overdueTaskIds =
          tasks?.filter((t) => t.status === "overdue").map((t) => t.id) || [];
        const emailResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/notifications/send-overdue-emails`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamMemberId: user.id,
              taskIds: overdueTaskIds,
            }),
          },
        );
        emailResult = await emailResponse.json();
      } catch (emailError) {
        console.error("Failed to send overdue emails:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Notification test completed",
      stats: {
        totalTasks,
        overdueCount,
        notificationsSent: overdueCount > 0,
        emailsSent: emailResult?.emailsSent || 0,
      },
      emailResult,
      tasks: tasks?.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
      })),
    });
  } catch (error) {
    console.error("Test notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/notifications/test
 * Get info about overdue tasks without sending notifications
 */
export async function GET(request: Request) {
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

    // Get teamMember email
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("email, first_name, last_name")
      .eq("id", user.id)
      .single();

    // Get all tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        status,
        due_date,
        due_time,
        customer:customers(business_name)
      `,
      )
      .eq("team_member_id", user.id)
      .order("due_date", { ascending: true });

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Categorize tasks
    const overdueTasks = tasks?.filter((t) => {
      if (t.status === "completed" || t.status === "cancelled") return false;
      return t.due_date < today;
    });

    const todayTasks = tasks?.filter(
      (t) =>
        t.due_date === today &&
        t.status !== "completed" &&
        t.status !== "cancelled",
    );

    return NextResponse.json({
      teamMember: {
        email: teamMember?.email,
        name: `${teamMember?.first_name} ${teamMember?.last_name || ""}`.trim(),
      },
      stats: {
        totalTasks: tasks?.length || 0,
        overdue: overdueTasks?.length || 0,
        today: todayTasks?.length || 0,
      },
      overdueTasks: overdueTasks?.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date,
        dueTime: t.due_time,
        customer: Array.isArray(t.customer) ? t.customer[0] : t.customer,
      })),
      todayTasks: todayTasks?.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date,
        dueTime: t.due_time,
        customer: Array.isArray(t.customer) ? t.customer[0] : t.customer,
      })),
      message:
        overdueTasks && overdueTasks.length > 0
          ? `You have ${overdueTasks.length} overdue task(s). Use POST to trigger email notifications.`
          : "No overdue tasks found.",
    });
  } catch (error) {
    console.error("Get notifications info error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
