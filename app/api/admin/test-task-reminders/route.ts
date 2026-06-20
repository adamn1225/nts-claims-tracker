import { NextRequest, NextResponse } from "next/server";
import { sendUpcomingTaskReminders } from "@/lib/notifications-server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase server client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * GET /api/admin/test-task-reminders?brokerId=xxx
 * 
 * SAFE TEST ENDPOINT - Only sends reminders to specific broker ID
 * Use this for testing without spamming all production users
 * 
 * Example: /api/admin/test-task-reminders?brokerId=1e8357cd-5268-4ac3-98f8-2dc42b9b69ee
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testBrokerId = searchParams.get("brokerId");
    const diagnose = searchParams.get("diagnose") === "true";

    if (!testBrokerId) {
      return NextResponse.json(
        {
          error: "Missing brokerId parameter",
          usage: "/api/admin/test-task-reminders?brokerId=YOUR_BROKER_ID",
          tip: "Add &diagnose=true to see diagnostic info without sending emails",
        },
        { status: 400 }
      );
    }

    console.log("🧪 TEST MODE: Checking reminders for broker:", testBrokerId);

    // DIAGNOSTIC MODE - Show what would happen without sending emails
    if (diagnose) {
      const now = new Date();
      
      // Get broker info
      const { data: brokers } = await supabase
        .from("brokers")
        .select(`
          id,
          email,
          first_name,
          last_name,
          user_preferences (
            email_notifications_enabled,
            digest_time
          )
        `)
        .eq("id", testBrokerId);

      const broker = brokers?.[0];
      if (!broker) {
        return NextResponse.json(
          { error: "Broker not found" },
          { status: 404 }
        );
      }

      const prefs = Array.isArray(broker.user_preferences)
        ? broker.user_preferences[0]
        : broker.user_preferences;

      // Get tasks with reminders
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          due_date,
          due_time,
          reminder_days,
          last_reminder_sent_date,
          status,
          customer:customers (
            business_name,
            contact_name
          )
        `)
        .eq("broker_id", testBrokerId)
        .eq("status", "pending")
        .not("due_time", "is", null)
        .not("reminder_days", "is", null);

      // Check which tasks have reminders within the ±10 minute window
      const tasksInWindow = (tasks || []).flatMap((task) => {
        if (!task.due_time || !task.reminder_days || task.reminder_days.length === 0) {
          return [];
        }

        // Parse due date and time
        const [year, month, day] = task.due_date.split("-").map(Number);
        const dueDate = new Date(year, month - 1, day);
        const [dueHours, dueMinutes] = task.due_time.split(":").map(Number);
        dueDate.setHours(dueHours, dueMinutes, 0, 0);

        // Check each reminder in the array
        return task.reminder_days.map((reminderMinutes: number) => {
          if (reminderMinutes === 0) return null; // Skip "No Reminder"

          // Calculate when this reminder should be sent
          const reminderTime = new Date(dueDate);
          reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutes);

          const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());
          const minutesDiff = timeDiff / (1000 * 60);
          const inWindow = minutesDiff <= 10;

          // Check if recently sent
          let recentlySent = false;
          if (task.last_reminder_sent_date) {
            const lastSent = new Date(task.last_reminder_sent_date);
            const minsSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60);
            recentlySent = minsSinceLastSent < 10;
          }

          return {
            id: task.id,
            title: task.title,
            due_date_time: `${task.due_date} ${task.due_time}`,
            reminder_minutes: reminderMinutes,
            reminderTimeFormatted: reminderTime.toLocaleString(),
            minutesUntilReminder: Math.round((reminderTime.getTime() - now.getTime()) / (1000 * 60)),
            minutesDiffFromNow: minutesDiff.toFixed(1),
            inWindow,
            recentlySent,
            last_reminder_sent: task.last_reminder_sent_date,
            wouldSendEmail: inWindow && !recentlySent && prefs?.email_notifications_enabled,
          };
        }).filter(Boolean);
      });

      return NextResponse.json({
        mode: "DIAGNOSTIC (no emails sent)",
        currentTime: now.toISOString(),
        currentTimeFormatted: now.toLocaleString(),
        broker: {
          id: broker.id,
          email: broker.email,
          name: `${broker.first_name} ${broker.last_name}`,
          emailNotificationsEnabled: prefs?.email_notifications_enabled ?? true,
          digestTime: prefs?.digest_time || "08:00",
        },
        window: "±10 minutes from current time",
        totalTasksWithReminders: tasks?.length || 0,
        tasksInWindow: tasksInWindow.filter((t) => t && t.inWindow).length,
        tasks: tasksInWindow,
      });
    }

    // ACTUAL TEST MODE - Send emails only to this broker
    const emailsSent = await sendUpcomingTaskReminders(testBrokerId);

    return NextResponse.json({
      success: true,
      mode: "TEST MODE (only sent to specified broker)",
      testBrokerId,
      emailsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in test-task-reminders:", error);
    return NextResponse.json(
      {
        error: "Failed to test task reminders",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
