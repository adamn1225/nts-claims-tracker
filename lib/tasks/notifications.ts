/**
 * Task-related notifications and reminder emails.
 *
 * Rewritten against the current claim-native schemas:
 *  - `tasks`         → assigned_to (uuid → profiles), due_at (timestamptz),
 *                      status enum (open|in_progress|blocked|completed|cancelled)
 *  - `notifications` → user_id, type, title, body, link,
 *                      related_entity_type, related_entity_id
 *
 * The three cron/API entry points are:
 *  - notifyTaskAssignedIfExternal(taskId)  → called by the tasks API on create
 *                                            or on assignee change
 *  - notifyTasksDueSoon()                  → cron: tasks due within DUE_WINDOW_MIN
 *  - notifyOverdueTasks()                  → cron: tasks past due_at, still active
 *
 * All three dedup by looking for an unread notification of the same
 * (user_id, type, related_entity_id). That keeps us from hammering an
 * assignee every cron tick while a task stays overdue.
 */

import { createClient } from "@supabase/supabase-js";
import { sendTaskReminderEmail } from "../email-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Priority mapping between the DB enum and the email template's vocabulary.
function mapPriority(
    p: string | null | undefined,
): "urgent" | "high" | "medium" | "low" {
    switch (p) {
        case "critical":
            return "urgent";
        case "high":
            return "high";
        case "low":
            return "low";
        default:
            return "medium";
    }
}

function splitDueAt(dueAt: string): { date: string; time: string } {
    const d = new Date(dueAt);
    const date = d.toISOString().slice(0, 10);
    const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    return { date, time };
}

function taskUrl(claimId: string): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${base}/dashboard/claims/${claimId}#tasks`;
}

type TaskContext = {
    id: string;
    claim_id: string;
    title: string;
    description: string | null;
    priority: string | null;
    due_at: string | null;
    assigned_to: string | null;
    created_by: string | null;
    status: string;
    claim: { claim_number: string | null } | null;
    assignee: {
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        is_active: boolean | null;
    } | null;
};

const TASK_SELECT = `
  id, claim_id, title, description, priority, due_at, assigned_to, created_by, status,
  claim:claims!tasks_claim_id_fkey ( claim_number ),
  assignee:profiles!tasks_assigned_to_fkey ( id, email, first_name, last_name, is_active )
`;

async function loadTask(taskId: string): Promise<TaskContext | null> {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", taskId)
        .maybeSingle();
    if (error || !data) return null;
    return data as unknown as TaskContext;
}

async function hasUnreadOfType(
    userId: string,
    type: string,
    taskId: string,
): Promise<boolean> {
    const supabase = getServiceSupabase();
    const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("related_entity_type", "task")
        .eq("related_entity_id", taskId)
        .is("read_at", null)
        .limit(1);
    return (data ?? []).length > 0;
}

async function insertNotification(row: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    link: string;
    taskId: string;
}) {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from("notifications").insert({
        user_id: row.user_id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        related_entity_type: "task",
        related_entity_id: row.taskId,
    });
    if (error) {
        console.error("[task notifications] insert error:", error);
    }
}

/**
 * Send an "assigned to you" notification when a task's assignee is set and
 * that assignee is someone other than the creator (self-notify rule from
 * copilot-instructions.md). Safe to call on both create and reassign; dedup
 * via unread-notification check.
 */
export async function notifyTaskAssignedIfExternal(taskId: string) {
    const task = await loadTask(taskId);
    if (!task || !task.assigned_to || !task.assignee) return;
    if (!task.assignee.is_active) return;
    if (task.assigned_to === task.created_by) return;
    if (await hasUnreadOfType(task.assigned_to, "task_assigned", task.id)) return;

    const claimNo = task.claim?.claim_number ?? "";
    const link = `/dashboard/claims/${task.claim_id}#tasks`;
    await insertNotification({
        user_id: task.assigned_to,
        type: "task_assigned",
        title: "New task assigned to you",
        body: claimNo ? `${task.title} \u2014 claim ${claimNo}` : task.title,
        link,
        taskId: task.id,
    });
}

/**
 * Called by the tasks API when a task is created or its assignee changes.
 * Preserves the historical `generateTaskNotifications(taskId)` contract
 * used by `/api/tasks/generate-notifications`.
 */
export async function generateTaskNotifications(taskId: string) {
    await notifyTaskAssignedIfExternal(taskId);
}

const DUE_WINDOW_MIN = 60;

/**
 * Notify assignees of tasks due within the next DUE_WINDOW_MIN minutes.
 * Called from `/api/cron/send-task-reminders`. Send once per task/user via
 * the unread-notification dedup guard.
 *
 * Returns the count of emails sent (in-app notifications may exceed this
 * when SendGrid is disabled).
 */
export async function notifyTasksDueSoon(
    testUserId?: string,
): Promise<number> {
    const supabase = getServiceSupabase();
    const now = new Date();
    const windowEnd = new Date(now.getTime() + DUE_WINDOW_MIN * 60 * 1000);

    let query = supabase
        .from("tasks")
        .select(TASK_SELECT)
        .in("status", ["open", "in_progress", "blocked"])
        .not("assigned_to", "is", null)
        .not("due_at", "is", null)
        .gte("due_at", now.toISOString())
        .lte("due_at", windowEnd.toISOString());

    if (testUserId) query = query.eq("assigned_to", testUserId);

    const { data, error } = await query;
    if (error) {
        console.error("[notifyTasksDueSoon] query error:", error);
        return 0;
    }
    const tasks = (data ?? []) as unknown as TaskContext[];
    let emailsSent = 0;

    for (const task of tasks) {
        if (!task.assigned_to || !task.assignee?.is_active) continue;
        if (await hasUnreadOfType(task.assigned_to, "task_due_soon", task.id))
            continue;

        const claimNo = task.claim?.claim_number ?? "";
        const link = `/dashboard/claims/${task.claim_id}#tasks`;
        await insertNotification({
            user_id: task.assigned_to,
            type: "task_due_soon",
            title: "Task due soon",
            body: claimNo ? `${task.title} \u2014 claim ${claimNo}` : task.title,
            link,
            taskId: task.id,
        });

        if (task.assignee.email && task.due_at) {
            try {
                const recipient = task.assignee.email;
                const name =
                    [task.assignee.first_name, task.assignee.last_name]
                        .filter(Boolean)
                        .join(" ") || recipient;
                const { date, time } = splitDueAt(task.due_at);
                const ok = await sendTaskReminderEmail(recipient, name, {
                    taskTitle: task.title,
                    taskDescription: task.description ?? undefined,
                    dueDate: date,
                    dueTime: time,
                    priority: mapPriority(task.priority),
                    customerName: claimNo ? `Claim ${claimNo}` : undefined,
                    taskUrl: taskUrl(task.claim_id),
                });
                if (ok) emailsSent += 1;
            } catch (err) {
                console.error("[notifyTasksDueSoon] email error:", err);
            }
        }
    }

    return emailsSent;
}

/**
 * Notify assignees of tasks that are past due and still active. Called from
 * `/api/cron/check-overdue-tasks`. Dedup ensures we send once per (user,
 * task) until the notification is read or the task is completed.
 */
export async function notifyOverdueTasks(): Promise<number> {
    const supabase = getServiceSupabase();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .in("status", ["open", "in_progress", "blocked"])
        .not("assigned_to", "is", null)
        .not("due_at", "is", null)
        .lt("due_at", nowIso);

    if (error) {
        console.error("[notifyOverdueTasks] query error:", error);
        return 0;
    }
    const tasks = (data ?? []) as unknown as TaskContext[];
    let emailsSent = 0;

    for (const task of tasks) {
        if (!task.assigned_to || !task.assignee?.is_active) continue;
        if (await hasUnreadOfType(task.assigned_to, "task_overdue", task.id))
            continue;

        const claimNo = task.claim?.claim_number ?? "";
        const link = `/dashboard/claims/${task.claim_id}#tasks`;
        await insertNotification({
            user_id: task.assigned_to,
            type: "task_overdue",
            title: "Task past due",
            body: claimNo
                ? `${task.title} \u2014 claim ${claimNo}`
                : task.title,
            link,
            taskId: task.id,
        });

        if (task.assignee.email && task.due_at) {
            try {
                const recipient = task.assignee.email;
                const name =
                    [task.assignee.first_name, task.assignee.last_name]
                        .filter(Boolean)
                        .join(" ") || recipient;
                const { date, time } = splitDueAt(task.due_at);
                const ok = await sendTaskReminderEmail(recipient, name, {
                    taskTitle: task.title,
                    taskDescription: task.description ?? undefined,
                    dueDate: date,
                    dueTime: time,
                    priority: mapPriority(task.priority),
                    customerName: claimNo ? `Claim ${claimNo}` : undefined,
                    taskUrl: taskUrl(task.claim_id),
                });
                if (ok) emailsSent += 1;
            } catch (err) {
                console.error("[notifyOverdueTasks] email error:", err);
            }
        }
    }

    return emailsSent;
}
