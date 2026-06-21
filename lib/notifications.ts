/**
 * Notification utilities for generating overdue task notifications
 */

import { createClient } from "@/lib/supabase/client";

export interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  due_time?: string;
  customer_id?: string;
  team_member_id: string;
}

/**
 * Check for overdue tasks and generate DAILY notifications
 * Creates a new notification each day for tasks that remain overdue
 * This should be called periodically (e.g., daily cron job, on page load)
 */
export async function generateOverdueNotifications(teamMemberId: string) {
  const supabase = createClient();

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0].substring(0, 5); // HH:MM

    // Find tasks that are overdue and not cancelled/completed
    const { data: overdueTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, due_date, due_time, customer_id, team_member_id")
      .eq("team_member_id", teamMemberId)
      .in("status", ["pending", "overdue"])
      .or(
        `due_date.lt.${today},and(due_date.eq.${today},due_time.lt.${currentTime})`,
      );

    if (tasksError) {
      console.error("Error fetching overdue tasks:", tasksError);
      return;
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return; // No overdue tasks
    }

    // Check which tasks already have a notification created TODAY
    const startOfToday = new Date(today).toISOString();
    const { data: todaysNotifications, error: notifError } = await supabase
      .from("notifications")
      .select("task_id")
      .eq("team_member_id", teamMemberId)
      .eq("type", "task_reminder")
      .in(
        "task_id",
        overdueTasks.map((t) => t.id),
      )
      .gte("created_at", startOfToday);

    if (notifError) {
      console.error("Error checking existing notifications:", notifError);
    }

    const notifiedTodayTaskIds = new Set(
      todaysNotifications?.map((n) => n.task_id) || [],
    );

    // Create NEW daily notifications for tasks that haven't been notified TODAY
    const newNotifications = overdueTasks
      .filter((task) => !notifiedTodayTaskIds.has(task.id))
      .map((task) => {
        const dueDateTime = task.due_time
          ? new Date(`${task.due_date}T${task.due_time}`)
          : new Date(task.due_date);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDateTime.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          team_member_id: task.team_member_id,
          task_id: task.id,
          customer_id: task.customer_id || null,
          type: "task_reminder",
          title: "Overdue Task",
          message:
            daysOverdue > 0
              ? `Task "${task.title}" is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`
              : `Task "${task.title}" is overdue`,
          is_read: false,
          is_archived: false,
          created_at: new Date().toISOString(),
        };
      });

    if (newNotifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(newNotifications);

      if (insertError) {
        console.error("Error creating overdue notifications:", insertError);
      } else {
        console.log(
          `Created ${newNotifications.length} daily overdue notifications`,
        );
        // Note: Email notifications are sent via /api/notifications/send-overdue-emails
        // This is called separately to keep client/server separation
      }
    }

    // Update task status to 'overdue' if still pending
    const overdueTaskIds = overdueTasks.map((t) => t.id);
    if (overdueTaskIds.length > 0) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "overdue" })
        .in("id", overdueTaskIds)
        .eq("status", "pending");

      if (updateError) {
        console.error("Error updating task status to overdue:", updateError);
      }
    }
  } catch (error) {
    console.error("Error in generateOverdueNotifications:", error);
  }
}

/**
 * Generate notification for a newly created follow-up that's already overdue
 */
export async function checkAndNotifyOverdueFollowUp(
  customerId: string,
  customerName: string,
  followUpDate: string,
  teamMemberId: string,
) {
  const supabase = createClient();

  const followUpDateTime = new Date(followUpDate);
  const now = new Date();

  if (followUpDateTime >= now) {
    return; // Not overdue yet
  }

  // Create overdue follow-up notification
  const { error } = await supabase.from("notifications").insert({
    team_member_id: teamMemberId,
    customer_id: customerId,
    type: "customer_update",
    title: "Overdue Follow-Up",
    message: `Follow-up with ${customerName} was due on ${followUpDateTime.toLocaleDateString()}`,
    is_read: false,
    is_archived: false,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating overdue follow-up notification:", error);
  }
}
