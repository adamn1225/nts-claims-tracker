"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Task,
  TaskType,
  TaskPriority,
  TaskStatus,
  Customer,
} from "@/lib/types";
import TaskFormModal from "@/components/TaskFormModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import TaskCompletionModal from "@/components/TaskCompletionModal";
import TaskFlowModal from "@/components/TaskFlowModal";
import { createClient } from "@/lib/supabase/client";
import { useBrokerView } from "@/contexts/BrokerViewContext";
import { checkOverdueNotifications } from "@/app/actions/notifications";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ListTodo,
  Phone,
  Mail,
  Users,
  User,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Bell,
  Target,
  DollarSign,
  TrendingUp,
  RefreshCw,
  UserPlus,
  MessageCircle,
  Video,
  X,
  Copy,
  Building2,
} from "lucide-react";

// Helper Functions
function getPriorityBadge(priority: string | null | undefined) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-300",
    high: "bg-orange-100 text-orange-700 border-orange-300",
    urgent: "bg-red-100 text-red-700 border-red-300",
    medium: "bg-amber-100 text-amber-700 border-amber-300",
    low: "bg-slate-100 text-slate-600 border-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${colors[priority] || colors.medium}`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function getStatusBadge(status: string) {
  const colors: Record<TaskStatus, string> = {
    pending: "bg-amber-100 text-amber-700",
    completed: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-700",
  };
  const statusKey = status as TaskStatus;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${colors[statusKey] || colors.pending}`}
    >
      {status === "pending" && <Clock className="mr-1 h-3 w-3" />}
      {status === "completed" && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {status === "overdue" && <AlertCircle className="mr-1 h-3 w-3" />}
      {status === "cancelled" && <X className="mr-1 h-3 w-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function getTypeIcon(type: TaskType) {
  const icons: Record<TaskType, typeof Phone> = {
    call: Phone,
    email: Mail,
    sms: MessageSquare,
    meeting: Users,
    internal_reminder: Bell,
    decision_day: Target,
    price_check_in: DollarSign,
    rate_reevaluation: TrendingUp,
    reactivation: RefreshCw,
    linkedin_connection: UserPlus,
    linkedin_message: MessageCircle,
    video_shoutout: Video,
    service_feedback: MessageSquare,
    follow_up: ListTodo,
    other: ListTodo,
  };
  const Icon = icons[type] || ListTodo;
  return <Icon className="h-3.5 w-3.5" />;
}

function formatDateTime(date: string, time?: string | null) {
  // Parse date string in local timezone to avoid timezone shifts
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);

  const formatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (!time || typeof time !== "string") return formatted;

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${formatted} ${displayHour}:${minutes} ${ampm}`;
}

function getDueIn(
  dueDate: string,
  dueTime?: string | null,
  status?: string | null,
) {
  // Completed/cancelled/archived tasks are never "overdue" — the clock stops
  // once the task is done. Show the final status instead of a due countdown.
  if (status === "completed")
    return <span className="text-green-600">Completed</span>;
  if (status === "cancelled")
    return <span className="text-slate-500">Cancelled</span>;
  if (status === "archived")
    return <span className="text-slate-500">Archived</span>;

  const now = new Date();

  // Parse due date in local timezone to avoid timezone shifts
  const [year, month, day] = dueDate.split("-").map(Number);
  const due = new Date(year, month - 1, day);

  if (dueTime && typeof dueTime === "string") {
    const [hours, minutes] = dueTime.split(":");
    due.setHours(parseInt(hours), parseInt(minutes));
  }

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  if (diffMs < 0) return <span className="text-red-600">Overdue</span>;
  if (diffDays === 0 && diffHours === 0)
    return <span className="text-amber-600">Due soon</span>;
  if (diffDays === 0)
    return <span className="text-amber-600">{diffHours}h</span>;
  if (diffDays === 1) return <span className="text-blue-600">Tomorrow</span>;
  return <span className="text-slate-600">{diffDays}d</span>;
}

function formatCreatedAt(createdAt: string | null) {
  if (!createdAt) return "—";
  const date = new Date(createdAt);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TasksPage() {
  const router = useRouter();
  const { viewingBroker, loading: brokerLoading } = useBrokerView();
  const [tasks, setTasks] = useState<(Task & { customer?: Customer })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<
    | "active"
    | "all"
    | "today"
    | "overdue"
    | "upcoming"
    | "completed"
    | "archived"
  >("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [viewingTask, setViewingTask] = useState<
    (Task & { customer?: Customer }) | null
  >(null);
  const [completingTask, setCompletingTask] = useState<
    (Task & { customer?: Customer }) | null
  >(null);
  const [showTaskFlow, setShowTaskFlow] = useState(false);
  const [showNoTasksModal, setShowNoTasksModal] = useState(false);
  const [showAllDoneModal, setShowAllDoneModal] = useState(false);

  // Fetch broker ID and initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      if (brokerLoading || !viewingBroker) return;

      // Fetch tasks and customers in parallel
      await Promise.all([
        fetchTasks(viewingBroker.id),
        fetchCustomers(viewingBroker.id),
      ]);

      // Check for overdue tasks and generate notifications
      await checkOverdueNotifications();

      // NOTE: Email sending is now handled by server-side cron jobs
      // See /api/cron/check-overdue-tasks (runs hourly)

      setIsLoading(false);
    };

    fetchInitialData();
  }, [viewingBroker, brokerLoading]);

  // Real-time subscription for tasks
  useEffect(() => {
    if (!viewingBroker) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`tasks:${viewingBroker.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `broker_id=eq.${viewingBroker.id}`,
        },
        async (payload) => {
          console.log("Real-time task change:", payload);
          // Refetch tasks to get updated data with customer info
          await fetchTasks(viewingBroker.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewingBroker]);

  const fetchTasks = async (userId: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        *,
        customer:customers(*)
      `,
      )
      .eq("broker_id", userId)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error fetching tasks:", error);
      return;
    }

    // Transform the data to match the expected type
    const tasksWithCustomers =
      data?.map((task: any) => ({
        ...task,
        customer: Array.isArray(task.customer)
          ? task.customer[0]
          : task.customer,
      })) || [];

    setTasks(tasksWithCustomers);
  };

  const fetchCustomers = async (userId: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("broker_id", userId)
      .order("business_name", { ascending: true });

    if (error) {
      console.error("Error fetching customers:", error);
      return;
    }

    setCustomers(data || []);
  };

  const handleCompleteTask = async (taskId: string) => {
    // Find the task to complete
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Open completion modal
    setCompletingTask(task);
  };

  const handleSaveCompletion = async (
    outcome: string,
    notes: string,
    followUpDate?: string,
    nextTask?: {
      title: string;
      type: TaskType;
      due_date: string;
      due_time?: string;
      priority?: string;
    },
  ) => {
    if (!completingTask) return;

    const supabase = createClient();
    let followUpTaskId: string | null = null;

    // If rescheduled or deferred, create a follow-up task
    if ((outcome === "rescheduled" || outcome === "deferred") && followUpDate) {
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: `Follow-up: ${completingTask.title}`,
          type: completingTask.type,
          customer_id: completingTask.customer_id,
          broker_id: completingTask.broker_id,
          due_date: followUpDate,
          priority: completingTask.priority,
          status: "pending" as TaskStatus,
          description: `Follow-up from previous task: ${completingTask.title}${notes ? `\n\nOriginal completion notes: ${notes}` : ""}`,
        })
        .select("id")
        .single();

      if (taskError) {
        console.error("Error creating follow-up task:", taskError);
        return;
      }

      followUpTaskId = newTask?.id || null;
    }

    // Create next task if provided (separate from reschedule flow)
    if (nextTask && completingTask.customer_id) {
      const { error: nextTaskError } = await supabase
        .from("tasks")
        .insert({
          title: nextTask.title,
          type: nextTask.type,
          customer_id: completingTask.customer_id,
          broker_id: completingTask.broker_id,
          due_date: nextTask.due_date,
          due_time: nextTask.due_time || null,
          priority: nextTask.priority || "medium",
          status: "pending" as TaskStatus,
          description: `Scheduled from completed task: ${completingTask.title}`,
        });

      if (nextTaskError) {
        console.error("Error creating next task:", nextTaskError);
        // Don't return - still complete the current task
      }
    }

    // Complete the original task with outcome and notes
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "completed" as TaskStatus,
        completed_at: new Date().toISOString(),
        completion_outcome: outcome,
        completion_notes: notes || null,
        follow_up_task_id: followUpTaskId,
      })
      .eq("id", completingTask.id);

    if (error) {
      console.error("Error completing task:", error);
      return;
    }

    // Update local state - mark as completed
    setTasks((prev) =>
      prev.map((t) =>
        t.id === completingTask.id
          ? {
              ...t,
              status: "completed" as TaskStatus,
              completed_at: new Date().toISOString(),
            }
          : t,
      ),
    );

    // If we created a follow-up or next task, refetch tasks to show it
    if ((followUpTaskId || nextTask) && viewingBroker) {
      await fetchTasks(viewingBroker.id);
    }

    // Note: Modal handles navigation/closing itself after completion
    // Close viewing task if open and it's the same task
    if (viewingTask?.id === completingTask.id) {
      setViewingTask(null);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDuplicateTask = (task: Task) => {
    // Create a copy with modified fields for the duplicate
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    // Don't use editingTask for duplicates - that's only for actual edits
    // Instead, create a partial task without ID properties
    const { id, created_at, updated_at, completed_at, reminder_sent, reminder_sent_at, last_reminder_sent_date, ...taskData } = task;
    
    const duplicatedTask: Partial<Task> = {
      ...taskData,
      title: `${task.title} (Copy)`,
      due_date: tomorrowString, // Set to tomorrow
      status: 'pending' as TaskStatus,
    };

    // Pass as a new task (editingTask = null, but form pre-filled via task prop workaround)
    // TaskFormModal will see this as a new task since there's no ID
    setEditingTask(duplicatedTask as Task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>): Promise<Task> => {
    const supabase = createClient();

    // Sanitize data: Convert empty strings to null for optional UUID/text fields
    const sanitizeTaskData = (data: Partial<Task>) => {
      const sanitized: any = { ...data };

      // Convert empty customer_id to null
      if (sanitized.customer_id === "" || sanitized.customer_id === undefined) {
        sanitized.customer_id = null;
      }

      // Convert empty due_time to null
      if (sanitized.due_time === "" || sanitized.due_time === undefined) {
        sanitized.due_time = null;
      }

      // Convert empty description to null
      if (sanitized.description === "" || sanitized.description === undefined) {
        sanitized.description = null;
      }

      return sanitized;
    };

    const cleanedData = sanitizeTaskData(taskData);

    if (editingTask && editingTask.id) {
      // Update existing task (has valid ID)
      const { error } = await supabase
        .from("tasks")
        .update({
          ...cleanedData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingTask.id);

      if (error) {
        console.error("Error updating task:", error);
        throw new Error(error.message ||"Failed to update task");
      }
      
      // Return updated task (fetch it)
      const { data: updatedTask } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", editingTask.id)
        .single();
      
      if (viewingBroker) await fetchTasks(viewingBroker.id);
      setEditingTask(null);
      return updatedTask;
    } else {
      // Create new task
      const newTask = {
        ...cleanedData,
        broker_id: viewingBroker?.id,
        status: "pending" as TaskStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single();

      if (error || !data) {
        console.error("Error creating task:", error?.message);
        throw new Error(error?.message || "Failed to create task");
      }

      console.log("Task created successfully:", data);
      
      // Generate notification records for reminders
      if (data.id && data.reminder_days && data.reminder_days.length > 0) {
        try {
          const response = await fetch("/api/tasks/generate-notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: data.id }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to generate notifications:", errorData);
          } else {
            const result = await response.json();
            console.log("Notifications generated:", result);
          }
        } catch (error) {
          console.error("Error calling generate-notifications API:", error);
        }
      } else {
        console.log("No reminders to generate (no reminder_days set or task has no ID)");
      }

      // Send email for urgent tasks
      if (data.priority === "urgent") {
        try {
          // Get user email from auth.users
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user?.email) {
            const { data: customerData } = data.customer_id
              ? await supabase
                  .from("customers")
                  .select("business_name")
                  .eq("id", data.customer_id)
                  .single()
              : { data: null };

            const response = await fetch("/api/send-task-reminder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipientEmail: user.email,
                recipientName:
                  user.user_metadata?.full_name || user.email.split("@")[0],
                taskData: {
                  taskTitle: data.title,
                  taskDescription: data.description,
                  dueDate: data.due_date,
                  dueTime: data.due_time,
                  customerName: customerData?.business_name,
                  taskUrl: `${window.location.origin}/dashboard/tasks`,
                  priority: data.priority,
                },
              }),
            });

            if (response.ok) {
              console.log("Urgent task email sent successfully");
            } else {
              const errorData = await response.json();
              console.error("Email API error:", errorData);
            }
          }
        } catch (emailError) {
          console.error("Failed to send urgent task email:", emailError);
          // Don't throw - email failure shouldn't break task creation
        }
      }

      // Refresh tasks
      if (viewingBroker) await fetchTasks(viewingBroker.id);
      setIsModalOpen(false);
      setEditingTask(null);
      return data;
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    const supabase = createClient();

    // Soft delete: set status to cancelled and add archive reason to description
    const archiveNote = archiveReason.trim()
      ? `[ARCHIVED: ${archiveReason}] ${taskToDelete.description || ""}`
      : taskToDelete.description;

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "cancelled" as TaskStatus,
        description: archiveNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskToDelete.id);

    if (error) {
      console.error("Error archiving task:", error);
      return;
    }

    // Refresh tasks
    if (viewingBroker) await fetchTasks(viewingBroker.id);
    setTaskToDelete(null);
    setArchiveReason("");
  };

  const filterTasks = (tasks: (Task & { customer?: Customer })[]) => {
    let filtered = tasks;

    // Apply filter
    const today = new Date().toISOString().split("T")[0];
    if (filter === "active") {
      // Show only active (pending/overdue) tasks - default view
      filtered = filtered.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      );
    } else if (filter === "completed") {
      // Show only completed tasks
      filtered = filtered.filter((t) => t.status === "completed");
    } else if (filter === "archived") {
      // Show only archived (cancelled) tasks
      filtered = filtered.filter((t) => t.status === "cancelled");
    } else if (filter === "all") {
      // Show all tasks (no status filtering)
      // Don't filter anything
    } else {
      // Filter out archived (cancelled) tasks from other views
      filtered = filtered.filter((t) => t.status !== "cancelled");

      if (filter === "today") {
        filtered = filtered.filter(
          (t) => t.due_date === today && t.status !== "completed",
        );
      } else if (filter === "overdue") {
        filtered = filtered.filter((t) => t.status === "overdue");
      } else if (filter === "upcoming") {
        filtered = filtered.filter(
          (t) => t.due_date > today && t.status !== "completed",
        );
      }
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.customer?.business_name?.toLowerCase().includes(query) ||
          t.customer?.contact_name?.toLowerCase().includes(query) ||
          t.customer?.first_name?.toLowerCase().includes(query) ||
          t.customer?.last_name?.toLowerCase().includes(query),
      );
    }

    return filtered;
  };

  const filteredTasks = filterTasks(tasks);

  const stats = {
    active: tasks.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled",
    ).length,
    all: tasks.length,
    today: tasks.filter(
      (t) =>
        t.due_date === new Date().toISOString().split("T")[0] &&
        t.status !== "completed" &&
        t.status !== "cancelled",
    ).length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
    upcoming: tasks.filter(
      (t) =>
        t.due_date > new Date().toISOString().split("T")[0] &&
        t.status !== "completed" &&
        t.status !== "cancelled",
    ).length,
    completed: tasks.filter((t) => t.status === "completed").length,
    archived: tasks.filter((t) => t.status === "cancelled").length,
  };

  // Check if all tasks are complete and show celebration modal
  useEffect(() => {
    if (!isLoading && tasks.length > 0 && stats.active === 0 && filter === "active") {
      // All active tasks are complete!
      setShowAllDoneModal(true);
    }
  }, [stats.active, tasks.length, isLoading, filter]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
              />
            </div>

            {/* Filter Buttons with Counts */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilter("active")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "active"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Active
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "active"
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {stats.active}
                </span>
              </button>
              <button
                onClick={() => setFilter("today")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "today"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Today
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "today"
                      ? "bg-orange-600 text-white"
                      : "bg-blue-100 text-blue-900"
                  }`}
                >
                  {stats.today}
                </span>
              </button>
              <button
                onClick={() => setFilter("overdue")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "overdue"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Overdue
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "overdue"
                      ? "bg-orange-600 text-white"
                      : "bg-red-100 text-red-900"
                  }`}
                >
                  {stats.overdue}
                </span>
              </button>
              <button
                onClick={() => setFilter("upcoming")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "upcoming"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Upcoming
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "upcoming"
                      ? "bg-orange-600 text-white"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {stats.upcoming}
                </span>
              </button>
              <button
                onClick={() => setFilter("completed")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "completed"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Completed
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "completed"
                      ? "bg-orange-600 text-white"
                      : "bg-green-100 text-green-900"
                  }`}
                >
                  {stats.completed}
                </span>
              </button>
              <button
                onClick={() => setFilter("archived")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "archived"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Archived
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "archived"
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {stats.archived}
                </span>
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                All
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    filter === "all"
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {stats.all}
                </span>
              </button>

              <div className="ml-2 h-6 w-px bg-slate-200" />

              <button
                onClick={() => router.push("/dashboard/sales-drill")}
                className="flex h-10 items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <ListTodo className="h-4 w-4" />
                Sales Drill
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task Table - Desktop / Cards - Mobile */}
      <div className="p-4">
        {/* Desktop Table View (hidden on mobile) */}
        <div className="relative hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <tr className="bg-white">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Task ID
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Type
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Customer
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Due Date/Time
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Notes
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Priority
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Due In
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Created
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    {/* Task ID */}
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      <button
                        onClick={() => setViewingTask(task)}
                        className="font-mono text-xs text-orange-600 underline hover:text-orange-500 cursor-pointer transition-colors"
                      >
                        #{task.id.slice(0, 8)}
                      </button>
                    </td>

                    {/* Type */}
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        {getTypeIcon(task.type as TaskType)}
                        <span className="capitalize">
                          {task.type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-3 py-2.5 sm:px-4">
                      {task.customer ? (
                        <div className="text-sm">
                          <Link
                            href={`/dashboard/customers/${task.customer.customer_id}`}
                            className="font-medium text-slate-900 hover:text-orange-600 hover:underline"
                          >
                            {task.customer.business_name || getCustomerDisplayName(task.customer) || "Unknown"}
                          </Link>
                          <div className="text-slate-600">
                            {getCustomerDisplayName(task.customer)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      {getStatusBadge(task.status)}
                    </td>

                    {/* Due Date/Time */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">
                      {formatDateTime(task.due_date, task.due_time)}
                    </td>

                    {/* Notes */}
                    <td className="max-w-xs px-3 py-2.5 sm:px-4">
                      <div className="truncate text-sm text-slate-600">
                        {task.title}
                        {task.description && (
                          <span className="text-slate-500">
                            {" "}
                            — {task.description}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      {getPriorityBadge(task.priority)}
                    </td>

                    {/* Due In */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm sm:px-4">
                      {getDueIn(task.due_date, task.due_time, task.status)}
                    </td>

                    {/* Created */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600 sm:px-4">
                      {formatCreatedAt(task.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right sm:px-4">
                      <div className="flex items-center justify-end gap-2">
                        {task.status !== "completed" && (
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="rounded p-1 text-slate-600 transition-colors hover:bg-green-100 hover:text-green-600"
                            title="Mark as complete"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicateTask(task)}
                          className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600"
                          title="Duplicate task"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditTask(task)}
                          className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-orange-600"
                          title="Edit task"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setTaskToDelete(task)}
                          className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-red-600"
                          title="Archive task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <ListTodo className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                    <p className="text-slate-600">No tasks found</p>
                    <p className="text-sm text-slate-500">
                      {searchQuery
                        ? "Try adjusting your search"
                        : "Create a new task to get started"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (visible on mobile only) */}
        <div className="space-y-3 md:hidden">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <button
                      onClick={() => setViewingTask(task)}
                      className="mb-1 font-mono text-xs text-orange-600 hover:underline"
                    >
                      #{task.id.slice(0, 8)}
                    </button>
                    <h3 className="font-medium text-slate-900">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {task.status !== "completed" && (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="rounded p-2 text-slate-600 transition-colors hover:bg-green-100 hover:text-green-600"
                        title="Mark as complete"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    )}
                   <button
                      onClick={() => handleEditTask(task)}
                      className="rounded p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-orange-600"
                      title="Edit task"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {getTypeIcon(task.type as TaskType)}
                      <span className="text-xs capitalize text-slate-600">
                        {task.type.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-slate-300">•</span>
                    {getStatusBadge(task.status)}
                    <span className="text-slate-300">•</span>
                    {getPriorityBadge(task.priority)}
                  </div>

                  {task.customer && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-700">{task.customer.business_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">
                      {formatDateTime(task.due_date, task.due_time)}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({getDueIn(task.due_date, task.due_time, task.status)})
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleDuplicateTask(task)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </button>
                  <button
                    onClick={() => setTaskToDelete(task)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Archive
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center">
              <ListTodo className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">No tasks found</p>
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Create a new task to get started"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Task Form Modal */}
      <TaskFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTask}
        task={editingTask}
        brokerId={viewingBroker?.id || ""}
        customers={customers}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={!!viewingTask}
        onClose={() => setViewingTask(null)}
        task={viewingTask}
        customer={viewingTask?.customer}
        onEdit={() => {
          if (viewingTask) {
            setEditingTask(viewingTask);
            setIsModalOpen(true);
            setViewingTask(null);
          }
        }}
        onDelete={() => {
          if (viewingTask) {
            setTaskToDelete(viewingTask);
            setViewingTask(null);
          }
        }}
        onComplete={() => {
          if (viewingTask) {
            handleCompleteTask(viewingTask.id);
          }
        }}
        allTasks={tasks.filter(t => t.status !== "completed" && t.status !== "cancelled")}
        currentIndex={viewingTask ? tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").findIndex(t => t.id === viewingTask.id) : undefined}
        onNavigate={(index) => {
          const activeTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
          if (index >= 0 && index < activeTasks.length) {
            setViewingTask(activeTasks[index]);
          } else {
            setViewingTask(null);
          }
        }}
      />

      {/* Task Completion Modal */}
      <TaskCompletionModal
        isOpen={!!completingTask}
        onClose={() => setCompletingTask(null)}
        task={completingTask}
        customer={completingTask?.customer}
        onComplete={handleSaveCompletion}
        allTasks={tasks.filter(t => t.status !== "completed" && t.status !== "cancelled")}
        currentIndex={completingTask ? tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").findIndex(t => t.id === completingTask.id) : undefined}
        onNavigate={(index) => {
          const activeTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
          if (index >= 0 && index < activeTasks.length) {
            setCompletingTask(activeTasks[index]);
          } else {
            // No more active tasks - close modal
            setCompletingTask(null);
          }
        }}
      />

      {/* Task Flow Modal */}
      <TaskFlowModal
        isOpen={showTaskFlow}
        onClose={() => setShowTaskFlow(false)}
        tasks={tasks}
        onTaskCompleted={async () => {
          if (viewingBroker) {
            await fetchTasks(viewingBroker.id);
          }
        }}
        onTaskDeleted={(taskId) => {
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            setTaskToDelete(task);
            setShowTaskFlow(false);
          }
        }}
        onTaskEdited={(task) => {
          setEditingTask(task);
          setIsModalOpen(true);
          setShowTaskFlow(false);
        }}
        brokerId={viewingBroker?.id || ""}
      />

      {/* No Tasks Modal */}
      {showNoTasksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <ListTodo className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Active Tasks
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                You don't have any active tasks at the moment. Create a new task to get started.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNoTasksModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowNoTasksModal(false);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Done Celebration Modal */}
      {showAllDoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden">
            {/* Celebration Header */}
            <div className="bg-linear-to-r from-green-600 to-emerald-600 px-6 py-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                All Tasks Complete!
              </h2>
              <p className="text-green-50 text-sm">
                Amazing work! You've completed all your active tasks. Keep the momentum going!
              </p>
            </div>

            {/* Task Suggestions */}
            <div className="px-6 py-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                What's Next? Here are some ideas:
              </h3>
              
              <div className="space-y-3">
                {/* Suggestion 1: Follow up with past clients */}
                <button
                  onClick={() => {
                    setShowAllDoneModal(false);
                    setEditingTask({
                      id: "",
                      title: "Follow up with 10 past clients",
                      description: "Review past orders and reach out to inactive customers to re-engage them and explore new opportunities.",
                      type: "follow_up",
                      priority: "high",
                      due_date: new Date().toISOString().split("T")[0],
                      due_time: null,
                      broker_id: viewingBroker?.id || "",
                      customer_id: null,
                      status: "pending",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      completed_at: null,
                      completion_outcome: null,
                      completion_notes: null,
                      follow_up_task_id: null,
                      reminder_days: [],
                      reminder_sent: null,
                      reminder_sent_at: null,
                      last_reminder_sent_date: null,
                      created_by: null,
                      requires_acceptance: null,
                      task_category: null,
                    } as Task);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-start gap-4 rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-orange-300 hover:bg-orange-50 group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 group-hover:bg-blue-200">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">
                      Follow up with past clients
                    </h4>
                    <p className="text-sm text-slate-600">
                      Re-engage 10 inactive customers from your past orders. One call could turn into a big opportunity.
                    </p>
                  </div>
                </button>

                {/* Suggestion 2: Cold calls */}
                <button
                  onClick={() => {
                    setShowAllDoneModal(false);
                    setEditingTask({
                      id: "",
                      title: "Make 50 cold calls",
                      description: "Reach out to new prospects from your unassigned contacts or target list. Goal: 50 calls, 5 meaningful conversations.",
                      type: "call",
                      priority: "high",
                      due_date: new Date().toISOString().split("T")[0],
                      due_time: null,
                      broker_id: viewingBroker?.id || "",
                      customer_id: null,
                      status: "pending",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      completed_at: null,
                      completion_outcome: null,
                      completion_notes: null,
                      follow_up_task_id: null,
                      reminder_days: [],
                      reminder_sent: null,
                      reminder_sent_at: null,
                      last_reminder_sent_date: null,
                      created_by: null,
                      requires_acceptance: null,
                      task_category: null,
                    } as Task);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-start gap-4 rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-orange-300 hover:bg-orange-50 group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 group-hover:bg-green-200">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">
                      Make cold calls to new prospects
                    </h4>
                    <p className="text-sm text-slate-600">
                      Set a goal of 50 outbound calls today. The more you dial, the more deals you'll close.
                    </p>
                  </div>
                </button>

                {/* Suggestion 3: Quote follow-ups */}
                <button
                  onClick={() => {
                    setShowAllDoneModal(false);
                    setEditingTask({
                      id: "",
                      title: "Follow up on pending quotes",
                      description: "Review all outstanding quotes and reach out to customers who haven't responded yet.",
                      type: "price_check_in",
                      priority: "medium",
                      due_date: new Date().toISOString().split("T")[0],
                      due_time: null,
                      broker_id: viewingBroker?.id || "",
                      customer_id: null,
                      status: "pending",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      completed_at: null,
                      completion_outcome: null,
                      completion_notes: null,
                      follow_up_task_id: null,
                      reminder_days: [],
                      reminder_sent: null,
                      reminder_sent_at: null,
                      last_reminder_sent_date: null,
                      created_by: null,
                      requires_acceptance: null,
                      task_category: null,
                    } as Task);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-start gap-4 rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-orange-300 hover:bg-orange-50 group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 group-hover:bg-amber-200">
                    <DollarSign className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">
                      Follow up on pending quotes
                    </h4>
                    <p className="text-sm text-slate-600">
                      Check in on customers who received quotes but haven't committed yet. Close the deals!
                    </p>
                  </div>
                </button>

                {/* Suggestion 4: Prospect research */}
                <button
                  onClick={() => {
                    setShowAllDoneModal(false);
                    setEditingTask({
                      id: "",
                      title: "Research and add 20 new prospects",
                      description: "Find and import 20 new high-quality prospects from your target industries or territories.",
                      type: "internal_reminder",
                      priority: "medium",
                      due_date: new Date().toISOString().split("T")[0],
                      due_time: null,
                      broker_id: viewingBroker?.id || "",
                      customer_id: null,
                      status: "pending",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      completed_at: null,
                      completion_outcome: null,
                      completion_notes: null,
                      follow_up_task_id: null,
                      reminder_days: [],
                      reminder_sent: null,
                      reminder_sent_at: null,
                      last_reminder_sent_date: null,
                      created_by: null,
                      requires_acceptance: null,
                      task_category: null,
                    } as Task);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-start gap-4 rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-orange-300 hover:bg-orange-50 group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 group-hover:bg-purple-200">
                    <Search className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">
                      Research new prospects
                    </h4>
                    <p className="text-sm text-slate-600">
                      Spend time building your pipeline. Add 20 new high-quality prospects to your database.
                    </p>
                  </div>
                </button>
              </div>

              {/* Footer Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowAllDoneModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowAllDoneModal(false);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  Create Custom Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Archive Task?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to archive &quot;{taskToDelete.title}
                &quot;? This will remove it from your active tasks list.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Reason for archiving (optional)
                </label>
                <textarea
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g., Customer no longer interested, Duplicate task, etc."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTaskToDelete(null);
                  setArchiveReason("");
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
