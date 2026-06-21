/**
 * Server-side notification generation functions
 * These run independently of user sessions
 */

import { createClient } from "@supabase/supabase-js";
import { sendTaskReminderEmail, sendEmail } from "./email-service";
import { generateDailyDigestHTML } from "./email-templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Create a service-role Supabase client (bypasses RLS)
 */
function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Fallback timezone used when a team member has no timezone preference set.
 * NTS historically operated entirely in US Eastern, so this preserves the
 * previous behavior for any teamMember who hasn't picked a timezone yet.
 */
const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Convert a wall-clock date/time in a given IANA timezone to the correct
 * absolute UTC instant, accounting for daylight saving time.
 *
 * This generalizes the old Eastern-only helper so each teamMember's tasks and
 * digest times are interpreted in their own timezone. The offset is computed
 * for the specific date, so DST transitions are handled automatically.
 */
function wallClockToUTC(
  year: number,
  month: number, // 1-indexed
  day: number,
  hour: number,
  minute: number,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  // First guess: treat the local wall-clock components as if they were UTC.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Determine the zone offset (local = UTC + offset) at that instant by
  // formatting the guess in the target timezone and comparing back to UTC.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcGuess));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  let localHour = get("hour");
  if (localHour === 24) localHour = 0; // some runtimes emit 24 for midnight
  const localAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    localHour,
    get("minute"),
    get("second"),
  );
  const offsetMinutes = (localAsUTC - utcGuess) / 60000;

  // The real UTC instant for the wall clock is the guess minus the offset.
  return new Date(utcGuess - offsetMinutes * 60000);
}

/**
 * Describe "now" as it appears on the wall clock in a given timezone.
 * Returns the calendar date (YYYY-MM-DD), the hour/minute, and a Date object
 * whose local fields match that wall clock (useful for comparing against task
 * due times that are also parsed as wall-clock values).
 */
function getNowInZone(timeZone: string = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const year = Number(getPart("year"));
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));
  let hour = Number(getPart("hour"));
  if (hour === 24) hour = 0; // some runtimes emit 24 for midnight
  const minute = Number(getPart("minute"));
  return {
    year,
    month,
    day,
    hour,
    minute,
    // Eastern/zone calendar date as YYYY-MM-DD
    dateStr: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    // Wall-clock "now" as a Date with matching local fields
    wallClock: new Date(year, month - 1, day, hour, minute),
  };
}

/**
 * Look up a team member's timezone preference, falling back to the default.
 */
async function getTeamMemberTimezone(
  supabase: ReturnType<typeof getServiceSupabase>,
  teamMemberId: string,
): Promise<string> {
  const { data } = await supabase
    .from("user_preferences")
    .select("timezone")
    .eq("team_member_id", teamMemberId)
    .maybeSingle();
  return data?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Generate notifications for a specific task based on reminder settings
 */
export async function generateTaskNotifications(taskId: string) {
  const supabase = getServiceSupabase();

  // Fetch the task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    console.error("Error fetching task:", taskError);
    return;
  }

  // Parse due_date and due_time in the team member's own timezone so reminders fire
  // at the correct local moment regardless of where the team member is located.
  const teamMemberTimezone = await getTeamMemberTimezone(supabase, task.team_member_id);

  if (!task.due_time) {
    // No reminders for all-day tasks (can't do "15 minutes before" without a time)
    console.log(`Task ${taskId} has no due_time, skipping reminder generation`);
    return;
  }

  // Validate and parse due_time (accepts HH:MM or HH:MM:SS format)
  const timeMatch = task.due_time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!timeMatch) {
    console.error(`Task ${taskId} has invalid due_time format: "${task.due_time}"`);
    return;
  }

  const [year, month, day] = task.due_date.split("-").map(Number);
  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);

  // Validate date components
  if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) {
    console.error(`Task ${taskId} has invalid date/time components:`, {
      due_date: task.due_date,
      due_time: task.due_time,
      parsed: { year, month, day, hours, minutes }
    });
    return;
  }
  
  // Build the absolute UTC instant for this task's due time in the team member's
  // timezone. DST-aware so reminders are not an hour off across transitions.
  const dueDate = wallClockToUTC(year, month, day, hours, minutes, teamMemberTimezone);

  // Verify the date is valid
  if (isNaN(dueDate.getTime())) {
    console.error(`Task ${taskId} resulted in invalid Date object:`, {
      due_date: task.due_date,
      due_time: task.due_time,
      components: { year, month, day, hours, minutes }
    });
    return;
  }
  
  console.log(`Task ${taskId} due date parsed:`, {
    input: { date: task.due_date, time: task.due_time },
    parsed: dueDate.toISOString(),
    localTime: dueDate.toLocaleString("en-US", { timeZone: teamMemberTimezone }),
  });

  const notifications = [];

  // Generate notification for each reminder (now in MINUTES before task)
  for (const minutesBefore of task.reminder_days || []) {
    // Skip if "No Reminder" (0 minutes)
    if (minutesBefore === 0) continue;

    const notificationDate = new Date(dueDate);
    notificationDate.setMinutes(notificationDate.getMinutes() - minutesBefore);

    const now = new Date();
    console.log(`Checking reminder ${minutesBefore} min before:`, {
      notificationDate: notificationDate.toISOString(),
      notificationDateLocal: notificationDate.toLocaleString("en-US", { timeZone: teamMemberTimezone }),
      now: now.toISOString(),
      nowLocal: now.toLocaleString("en-US", { timeZone: teamMemberTimezone }),
      isFuture: notificationDate > now,
    });

    // Only create notifications for future times
    if (notificationDate > now) {
      // Format time as 12-hour format
      const [hours, minutes] = task.due_time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      const timeString = `${displayHour}:${minutes} ${ampm}`;

      // Format reminder time (e.g., "15 minutes" or "1 hour")
      let reminderTime = "";
      if (minutesBefore >= 60) {
        const hours = minutesBefore / 60;
        reminderTime = `${hours} hour${hours > 1 ? "s" : ""}`;
      } else {
        reminderTime = `${minutesBefore} minutes`;
      }

      notifications.push({
        team_member_id: task.team_member_id,
        type: "task_reminder",
        title: `Task Due in ${reminderTime}`,
        message: `${task.title} is due at ${timeString}`,
        task_id: task.id,
        customer_id: task.customer_id,
        link_url: "/dashboard/tasks",
        is_read: false,
        is_archived: false,
        scheduled_for: notificationDate.toISOString(), // Schedule for the reminder time
        created_at: new Date().toISOString(),
      });
    }
  }

  // Insert all notifications
  if (notifications.length > 0) {
    console.log(`📝 Inserting ${notifications.length} notifications:`, notifications.map(n => ({
      scheduled_for: n.scheduled_for,
      scheduled_for_est: new Date(n.scheduled_for).toLocaleString("en-US", { timeZone: "America/New_York" }),
      title: n.title,
    })));
    
    const { data, error } = await supabase
      .from("notifications")
      .insert(notifications)
      .select();

    if (error) {
      console.error("❌ Error creating notifications:", error);
    } else {
      console.log(`✅ Successfully created ${data?.length || 0} notifications for task ${taskId}`);
    }
  } else {
    console.log(`⚠️ No notifications to create for task ${taskId} (all reminder times are in the past)`);
  }
}

/**
 * Send daily reminder emails for past-due tasks
 * Does NOT change task status - status is user-controlled workflow state
 * This should be run by a cron job daily (e.g., 8 AM)
 */
export async function sendOverdueTaskReminders() {
  const supabase = getServiceSupabase();

  console.log("Checking for past-due tasks...");

  // Find all non-completed/non-archived tasks
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      customer:customers(business_name, contact_name)
    `,
    )
    .neq("status", "completed")
    .neq("status", "archived");

  if (error) {
    console.error("Error fetching tasks:", error);
    return 0;
  }

  // Build a team member -> timezone map so each task's due time is evaluated in the
  // owning teamMember's timezone (nationwide team across multiple zones).
  const { data: allPrefs } = await supabase
    .from("user_preferences")
    .select("team_member_id, timezone");
  const timezoneByTeamMember = new Map<string, string>(
    (allPrefs || []).map((p) => [p.team_member_id, p.timezone || DEFAULT_TIMEZONE]),
  );

  const now = new Date();
  const overdueTasks = [];

  for (const task of tasks || []) {
    const tz = timezoneByTeamMember.get(task.team_member_id) || DEFAULT_TIMEZONE;

    // Check if task is past due, interpreting its due time in the team member's tz.
    const [year, month, day] = task.due_date.split("-").map(Number);
    let dueDate: Date;
    if (task.due_time) {
      const [hours, minutes] = task.due_time.split(":").map(Number);
      dueDate = wallClockToUTC(year, month, day, hours, minutes, tz);
    } else {
      dueDate = wallClockToUTC(year, month, day, 23, 59, tz); // End of local day
    }

    if (dueDate >= now) continue; // Not overdue yet

    // Check if we already sent an email today (teamMember-local calendar day).
    const todayLocal = getNowInZone(tz).dateStr;
    if (task.last_reminder_sent_date) {
      const lastSent = new Date(task.last_reminder_sent_date).toLocaleDateString(
        "en-CA",
        { timeZone: tz },
      ); // en-CA -> YYYY-MM-DD
      if (lastSent === todayLocal) continue; // Already sent today
    }

    overdueTasks.push(task);
  }

  if (overdueTasks.length === 0) {
    console.log("No past-due tasks needing reminders");
    return 0;
  }

  console.log(`Found ${overdueTasks.length} past-due tasks`);

  let emailsSent = 0;
  const emailLog: Array<{ teamMember: string; task: string; status: string }> = [];

  // Send email notifications for each overdue task
  for (const task of overdueTasks) {
    // Create in-app notification (no status change!)
    const { error: notifError } = await supabase.from("notifications").insert({
      team_member_id: task.team_member_id,
      type: "task_reminder",
      title: "Task Past Due",
      message: `${task.title} is past its due date`,
      task_id: task.id,
      customer_id: task.customer_id,
      link_url: "/dashboard/tasks",
      is_read: false,
      is_archived: false,
      created_at: new Date().toISOString(),
    });

    if (notifError) {
      console.error(
        `Error creating notification for task ${task.id}:`,
        notifError,
      );
    }

    // Fetch team member info for email
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("email, first_name, last_name, is_active")
      .eq("id", task.team_member_id)
      .single();

    // Skip sending email if teamMember account is deactivated
    if (!teamMember || teamMember.is_active === false) {
      console.log(
        `Skipping overdue email: TeamMember ${task.team_member_id} is deactivated`,
      );
      emailLog.push({
        teamMember: teamMember?.email || "Unknown",
        task: task.title,
        status: "skipped (deactivated)",
      });
      continue;
    }

    if (teamMember?.email) {
      // Send overdue email notification
      try {
        const emailSent = await sendTaskReminderEmail(
          teamMember.email,
          `${teamMember.first_name} ${teamMember.last_name || ""}`.trim(),
          {
            taskTitle: task.title,
            taskDescription: task.description,
            dueDate: task.due_date,
            dueTime: task.due_time,
            priority: task.priority,
            customerName: task.customer?.business_name || "No customer",
            taskUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/tasks`,
          },
        );
        if (emailSent) {
          emailsSent++;
          console.log(
            `Sent overdue reminder to ${teamMember.email} for task: ${task.title}`,
          );
          emailLog.push({
            teamMember: teamMember.email,
            task: task.title,
            status: "sent",
          });

          // Update last reminder sent date
          await supabase
            .from("tasks")
            .update({ last_reminder_sent_date: new Date().toISOString() })
            .eq("id", task.id);
        } else {
          console.error(
            `Failed to send overdue email to ${teamMember.email} for task: ${task.title}`,
          );
          emailLog.push({
            teamMember: teamMember.email,
            task: task.title,
            status: "failed",
          });
        }
      } catch (emailError) {
        console.error(
          `Error sending overdue email for task ${task.id}:`,
          emailError,
        );
      }
    }
  }

  console.log(`Sent ${emailsSent} overdue task reminder emails`);
  console.table(emailLog);
  return emailsSent;
}

/**
 * Send reminder emails for upcoming tasks
 * This is called by pg_cron every 10 minutes and checks tasks with time-based reminders
 * (e.g., "15 minutes before", "1 hour before")
 * 
 * PATTERN MATCHES WORKING sendDailyDigestEmails() FUNCTION
 * 
 * @param testTeamMemberId - Optional: If provided, only send reminders to this teamMember (for safe testing)
 */
export async function sendUpcomingTaskReminders(testTeamMemberId?: string) {
  const supabase = getServiceSupabase();

  if (testTeamMemberId) {
    console.log("🧪 TEST MODE: Only processing team member:", testTeamMemberId);
  } else {
    console.log("🔔 Checking for upcoming task reminders...");
  }

  const now = new Date();

  // Step 1: Get all team members with email preferences (SAME AS DAILY DIGEST)
  let teamMemberQuery = supabase.from("team_members").select(
    `
      id,
      email,
      first_name,
      last_name,
      user_preferences:user_preferences(
        email_notifications_enabled,
        timezone
      )
    `,
  )
  .neq("is_active", false); // FILTER: Only send to active accounts

  // TEST MODE: Filter to specific teamMember only
  if (testTeamMemberId) {
    teamMemberQuery = teamMemberQuery.eq("id", testTeamMemberId);
  }

  const { data: teamMembers, error: teamMembersError } = await teamMemberQuery;

  if (teamMembersError) {
    console.error("Error fetching team members:", teamMembersError);
    return 0;
  }

  if (testTeamMemberId) {
    console.log(`🧪 TEST MODE: Found ${teamMembers?.length || 0} team member(s) matching ID`);
  } else {
    console.log(`Found ${teamMembers?.length || 0} total team members in database`);
  }

  let emailsSent = 0;
  const emailLog: Array<{
    teamMember: string;
    task: string;
    status: string;
    reason?: string;
  }> = [];

  // Step 2: Loop through each teamMember (SAME AS DAILY DIGEST)
  for (const teamMember of teamMembers || []) {
    console.log(`Processing team member: ${teamMember.email}`);
    
    // Check if email notifications are enabled
    const prefs = Array.isArray(teamMember.user_preferences)
      ? teamMember.user_preferences[0]
      : teamMember.user_preferences;
      
    if (!prefs?.email_notifications_enabled) {
      console.log(`   Email notifications disabled for ${teamMember.email}`);
      continue;
    }

    // Interpret this teamMember's task times in their own timezone.
    const teamMemberTimezone = prefs.timezone || DEFAULT_TIMEZONE;
    const currentLocalTime = now.toLocaleString("en-US", {
      timeZone: teamMemberTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    console.log(`   Local time for ${teamMember.email}: ${currentLocalTime} (${teamMemberTimezone})`);

    // Step 3: Get this teamMember's pending tasks with times and reminders
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(
        `
        *,
        customer:customers(business_name, contact_name)
      `,
      )
      .eq("team_member_id", teamMember.id)
      .eq("status", "pending")
      .not("due_time", "is", null) // Only tasks with specific time
      .not("reminder_days", "is", null); // Only tasks with reminders

    if (tasksError) {
      console.error(`   Error fetching tasks for ${teamMember.email}:`, tasksError);
      continue;
    }

    console.log(`   Found ${tasks?.length || 0} pending tasks with reminders`);

    // Step 4: Check each task to see if any reminders need to be sent NOW
    for (const task of tasks || []) {
      // Skip if no reminder configured
      if (!task.reminder_days || task.reminder_days.length === 0) continue;

      // Parse due date and time in the team member's timezone (same logic as
      // generateTaskNotifications).
      const [year, month, day] = task.due_date.split("-").map(Number);
      const timeMatch = task.due_time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (!timeMatch) {
        console.warn(`Task ${task.id} has invalid due_time format: "${task.due_time}", skipping`);
        continue;
      }
      const dueHours = parseInt(timeMatch[1]);
      const dueMinutes = parseInt(timeMatch[2]);

      // Build the absolute UTC instant for this task's due time in the team member's
      // timezone. DST-aware so reminders fire at the right moment year-round.
      const dueDate = wallClockToUTC(
        year,
        month,
        day,
        dueHours,
        dueMinutes,
        teamMemberTimezone,
      );

      // Check if ANY reminder was sent recently (within last 10 minutes to avoid duplicates)
      if (task.last_reminder_sent_date) {
        const lastSent = new Date(task.last_reminder_sent_date);
        const minsSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60);

        if (minsSinceLastSent < 10) {
          console.log(`   Task "${task.title}": Reminder sent recently, skipping`);
          continue;
        }
      }

      // Check each reminder time to see if any match the current time
      let reminderToSend: number | null = null;
      
      for (const reminderMinutes of task.reminder_days) {
        // Skip if "No Reminder" (0 minutes)
        if (reminderMinutes === 0) continue;

        // Calculate when this specific reminder should be sent
        const reminderTime = new Date(dueDate);
        reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutes);

        // Check if we're within ±10 minutes of this reminder time (SAME WINDOW AS DAILY DIGEST)
        const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());
        const minutesDiff = timeDiff / (1000 * 60);

        if (minutesDiff <= 10) {
          reminderToSend = reminderMinutes;
          console.log(`   Task "${task.title}": Reminder match! (${reminderMinutes} min before, window: ${minutesDiff.toFixed(1)} min)`);
          break; // Found a matching reminder
        }
      }

      // If no reminder matches current time, skip this task
      if (reminderToSend === null) continue;

      // Step 5: Send email (SAME AS DAILY DIGEST)
      try {
        const emailSent = await sendTaskReminderEmail(
          teamMember.email,
          `${teamMember.first_name} ${teamMember.last_name || ""}`.trim(),
          {
            taskTitle: task.title,
            taskDescription: task.description,
            dueDate: task.due_date,
            dueTime: task.due_time,
            priority: task.priority,
            customerName: task.customer?.business_name || "No customer",
            taskUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/tasks`,
          },
        );
        
        if (emailSent) {
          emailsSent++;
          console.log(
            `✅ Sent ${reminderToSend}-minute reminder to ${teamMember.email} for task: ${task.title}`,
          );
          emailLog.push({
            teamMember: teamMember.email,
            task: task.title,
            status: "sent",
          });

          // Update last reminder sent date
          await supabase
            .from("tasks")
            .update({ last_reminder_sent_date: new Date().toISOString() })
            .eq("id", task.id);
        } else {
          console.error(
            `❌ Failed to send reminder email to ${teamMember.email} for task: ${task.title}`,
          );
          emailLog.push({
            teamMember: teamMember.email,
            task: task.title,
            status: "failed",
          });
        }
      } catch (emailError) {
        console.error(
          `Error sending reminder email for task ${task.id}:`,
          emailError,
        );
        emailLog.push({
          teamMember: teamMember.email,
          task: task.title,
          status: "error",
          reason: String(emailError),
        });
      }
    }
  }

  console.log(`📬 Sent ${emailsSent} task reminder emails`);
  if (emailLog.length > 0) {
    console.table(emailLog);
  }
  return emailsSent;
}

/**
 * Send daily digest emails to ALL users
 * Consolidated task overview instead of spamming individual overdue emails
 * Encourages task creation if user has no tasks
 * This should be run by a cron job daily (e.g., 8 AM)
 */
export async function sendDailyDigestEmails(specificTeamMemberId?: string) {
  const supabase = getServiceSupabase();

  console.log("Generating daily digest emails for all users...");

  // Build query to get teamMembers with user preferences
  let query = supabase.from("team_members").select(
    `
      id,
      email,
      first_name,
      last_name,
      user_preferences:user_preferences(
        email_notifications_enabled,
        digest_time,
        last_digest_sent_date,
        timezone
      )
    `,
  )
  .neq("is_active", false); // FILTER: Only send to active accounts

  // If specific teamMember ID provided, filter to that teamMember only
  if (specificTeamMemberId) {
    query = query.eq("id", specificTeamMemberId);
  }

  const { data: teamMembers, error: teamMembersError } = await query;

  if (teamMembersError) {
    console.error("Error fetching team members:", teamMembersError);
    return 0;
  }

  console.log(`Found ${teamMembers?.length || 0} total team members in database`);

  // Each teamMember may be in a different timezone (nationwide team / travelers).
  // The server (Netlify) runs in UTC, so for every teamMember we compute "now" as
  // it appears on their own wall clock before comparing against their
  // digest_time preference and task due dates. Otherwise an 08:00 local digest
  // would fire at the wrong hour and not-yet-due tasks would look overdue
  // across the UTC midnight boundary.
  let emailsSent = 0;
  const emailLog: Array<{ teamMember: string; tasks: string; status: string }> = [];

  for (const teamMember of teamMembers || []) {
    console.log(`Processing team member: ${teamMember.email}`);
    console.log(`   User preferences:`, teamMember.user_preferences);
    // Check if email notifications are enabled
    // user_preferences is returned as an array from the join, get first item
    const prefs = Array.isArray(teamMember.user_preferences)
      ? teamMember.user_preferences[0]
      : teamMember.user_preferences;
    if (!prefs?.email_notifications_enabled) {
      emailLog.push({
        teamMember: teamMember.email,
        tasks: "N/A",
        status: "Email disabled",
      });
      continue;
    }

    // Compute "now" in this teamMember's timezone.
    const teamMemberTimezone = prefs.timezone || DEFAULT_TIMEZONE;
    const localNow = getNowInZone(teamMemberTimezone);
    const today = localNow.dateStr;
    const currentHour = localNow.hour;
    const currentMinute = localNow.minute;
    const teamMemberNow = localNow.wallClock;
    const currentTimeString = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

    // Check if it's time to send digest to this user (±10 minute window)
    // Use user's digest_time preference, default to 8:00 AM if not set
    const preferredTime = prefs.digest_time || "08:00";
    const [prefHour, prefMin] = preferredTime.split(":").map(Number);
    const prefTimeInMinutes = prefHour * 60 + prefMin;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const timeDiff = Math.abs(currentTimeInMinutes - prefTimeInMinutes);

    if (timeDiff > 10) {
      emailLog.push({
        teamMember: teamMember.email,
        tasks: "N/A",
        status: `Wrong time (wants ${preferredTime} ${teamMemberTimezone}, now ${currentTimeString})`,
      });
      console.log(
        `   Skipping: User wants ${preferredTime} (${teamMemberTimezone}), current is ${currentTimeString} (diff: ${timeDiff} min)`,
      );
      continue;
    }

    console.log(
      `   Time match! Sending digest (user wants ${preferredTime}, current is ${currentTimeString})`,
    );

    // Check if we already sent digest today (prevent duplicates from overlapping time windows)
    if (prefs.last_digest_sent_date === today) {
      emailLog.push({
        teamMember: teamMember.email,
        tasks: "N/A",
        status: "Already sent today",
      });
      console.log(`   Skipping: Already sent digest today (${today})`);
      continue;
    }

    try {
      // Fetch all non-completed tasks for this teamMember
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          customer:customers(business_name, contact_name)
        `,
        )
        .eq("team_member_id", teamMember.id)
        .neq("status", "completed")
        .neq("status", "archived")
        .order("due_date", { ascending: true });

      if (tasksError) {
        console.error(`Error fetching tasks for ${teamMember.email}:`, tasksError);
        emailLog.push({
          teamMember: teamMember.email,
          tasks: "N/A",
          status: `DB error`,
        });
        continue;
      }

      // Categorize and prioritize tasks
      const overdueTasks = [];
      const todayTasks = [];
      const upcomingTasks = [];

      for (const task of tasks || []) {
        const [year, month, day] = task.due_date.split("-").map(Number);
        const taskDate = new Date(year, month - 1, day);

        if (task.due_time) {
          const [hours, minutes] = task.due_time.split(":");
          taskDate.setHours(parseInt(hours), parseInt(minutes));
        } else {
          taskDate.setHours(23, 59, 59); // End of day if no time
        }

        const dueDateStr = task.due_date;

        if (
          dueDateStr < today ||
          (dueDateStr === today && taskDate < teamMemberNow)
        ) {
          overdueTasks.push(task);
        } else if (dueDateStr === today) {
          todayTasks.push(task);
        } else {
          // Only include upcoming tasks within next 7 days
          const daysUntil = Math.floor(
            (taskDate.getTime() - teamMemberNow.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntil <= 7) {
            upcomingTasks.push(task);
          }
        }
      }

      // Sort each category by priority (urgent > high > medium > low)
      const priorityOrder: Record<string, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      const sortByPriority = (a: any, b: any) => {
        const aPriority = priorityOrder[a.priority || "medium"] ?? 4;
        const bPriority = priorityOrder[b.priority || "medium"] ?? 4;
        return aPriority - bPriority;
      };

      overdueTasks.sort(sortByPriority);
      todayTasks.sort(sortByPriority);
      upcomingTasks.sort(sortByPriority);

      // Generate email HTML
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const { html, subject } = await generateDailyDigestHTML(
        teamMember.first_name || "there",
        {
          overdueTasks,
          todayTasks,
          upcomingTasks: upcomingTasks.slice(0, 10), // Limit to 10
        },
        appUrl,
      );

      // Send email
      const emailSent = await sendEmail({
        to: teamMember.email,
        subject,
        html,
      });

      if (emailSent) {
        emailsSent++;
        
        // Update last_digest_sent_date to prevent duplicate sends today
        await supabase
          .from("user_preferences")
          .update({ last_digest_sent_date: today })
          .eq("team_member_id", teamMember.id);

        const totalTasks =
          overdueTasks.length + todayTasks.length + upcomingTasks.length;
        emailLog.push({
          teamMember: teamMember.email,
          tasks: `${overdueTasks.length} overdue, ${todayTasks.length} today, ${upcomingTasks.length} upcoming`,
          status: totalTasks === 0 ? "Sent (empty)" : "Sent",
        });
      } else {
        emailLog.push({
          teamMember: teamMember.email,
          tasks: "N/A",
          status: "Send failed",
        });
      }
    } catch (error) {
      emailLog.push({
        teamMember: teamMember.email,
        tasks: "N/A",
        status: `${error}`,
      });
    }
  }

  console.log(`Sent ${emailsSent} daily digest emails`);
  if (emailLog.length > 0) {
    console.table(emailLog);
  }
  return emailsSent;
}
