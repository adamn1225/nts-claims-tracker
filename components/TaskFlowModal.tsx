"use client";

import { useState, useEffect } from "react";
import { Task, TaskType, TaskStatus, Customer, CustomerStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Bell,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  UserPlus,
  MessageCircle,
  Video,
  ListTodo,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  Edit,
  Trash2,
  PhoneOff,
  Ban,
  Check,
  XCircle,
} from "lucide-react";

interface TaskFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: (Task & { customer?: Customer })[];
  onTaskCompleted: () => void;
  onTaskDeleted: (taskId: string) => void;
  onTaskEdited: (task: Task) => void;
  brokerId: string;
}

type CompletionOutcome =
  | "won_deal"
  | "lost_deal"
  | "no_answer"
  | "not_interested"
  | "rescheduled"
  | "completed"
  | "deferred"
  | "cancelled"
  | "other";

const typeIcons: Record<TaskType, typeof Phone> = {
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

export default function TaskFlowModal({
  isOpen,
  onClose,
  tasks: allTasks,
  onTaskCompleted,
  onTaskDeleted,
  onTaskEdited,
  brokerId,
}: TaskFlowModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showingCompletion, setShowingCompletion] = useState(false);
  const [filterCustomerOnly, setFilterCustomerOnly] = useState(true);
  const [customerStatuses, setCustomerStatuses] = useState<CustomerStatus[]>([]);

  // Completion form state
  const [selectedOutcome, setSelectedOutcome] = useState<CompletionOutcome | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [newCustomerStatus, setNewCustomerStatus] = useState<string>("");
  
  // Schedule next task state
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextTaskTitle, setNextTaskTitle] = useState("");
  const [nextTaskType, setNextTaskType] = useState<TaskType>("follow_up");
  const [nextTaskDate, setNextTaskDate] = useState("");
  const [nextTaskTime, setNextTaskTime] = useState("");
  const [nextTaskPriority, setNextTaskPriority] = useState<string>("medium");

  // Filter tasks
  const tasks = filterCustomerOnly
    ? allTasks.filter((t) => t.customer_id && t.status !== "completed" && t.status !== "cancelled")
    : allTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");

  const currentTask = tasks[currentIndex];

  // Load customer statuses for status change dropdown
  useEffect(() => {
    const loadCustomerStatuses = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customer_statuses")
        .select("*")
        .order("position", { ascending: true });

      if (!error && data) {
        setCustomerStatuses(data);
      }
    };

    if (isOpen) {
      loadCustomerStatuses();
    }
  }, [isOpen]);

  // Initialize customer status when task changes
  useEffect(() => {
    if (currentTask?.customer) {
      setNewCustomerStatus(currentTask.customer.status);
    }
  }, [currentTask]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetCompletionForm();
    }
  };

  const handleNext = () => {
    if (currentIndex < tasks.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetCompletionForm();
    }
  };

  const resetCompletionForm = () => {
    setShowingCompletion(false);
    setSelectedOutcome(null);
    setCompletionNotes("");
    setFollowUpDate("");
    setScheduleNext(false);
    setNextTaskTitle("");
    setNextTaskType("follow_up");
    setNextTaskDate("");
    setNextTaskTime("");
    setNextTaskPriority("medium");
  };

  const handleCompleteClick = () => {
    setShowingCompletion(true);
  };

  const handleSaveCompletion = async () => {
    if (!selectedOutcome || !currentTask) return;

    // Validate required fields
    if ((selectedOutcome === "rescheduled" || selectedOutcome === "deferred") && !followUpDate) {
      alert("Please select a follow-up date");
      return;
    }

    if (scheduleNext && currentTask.customer_id) {
      if (!nextTaskDate || !nextTaskTitle.trim()) {
        alert("Please provide a title and date for the next task");
        return;
      }
    }

    const supabase = createClient();
    let followUpTaskId: string | null = null;

    // If rescheduled or deferred, create a follow-up task
    if ((selectedOutcome === "rescheduled" || selectedOutcome === "deferred") && followUpDate) {
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: `Follow-up: ${currentTask.title}`,
          type: currentTask.type,
          customer_id: currentTask.customer_id,
          broker_id: currentTask.broker_id,
          due_date: followUpDate,
          priority: currentTask.priority,
          status: "pending" as TaskStatus,
          description: `Follow-up from previous task: ${currentTask.title}${completionNotes ? `\n\nOriginal completion notes: ${completionNotes}` : ""}`,
        })
        .select("id")
        .single();

      if (taskError) {
        console.error("Error creating follow-up task:", taskError);
        return;
      }

      followUpTaskId = newTask?.id || null;
    }

    // Create next task if scheduled
    if (scheduleNext && currentTask.customer_id && nextTaskDate && nextTaskTitle.trim()) {
      await supabase
        .from("tasks")
        .insert({
          title: nextTaskTitle.trim(),
          type: nextTaskType,
          customer_id: currentTask.customer_id,
          broker_id: brokerId,
          due_date: nextTaskDate,
          due_time: nextTaskTime || null,
          priority: nextTaskPriority,
          status: "pending" as TaskStatus,
          description: `Scheduled from completed task: ${currentTask.title}`,
        });
    }

    // Update customer status if changed
    if (currentTask.customer && newCustomerStatus !== currentTask.customer.status) {
      await supabase
        .from("customers")
        .update({
          status: newCustomerStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentTask.customer.id);
    }

    // Complete the task
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "completed" as TaskStatus,
        completed_at: new Date().toISOString(),
        completion_outcome: selectedOutcome,
        completion_notes: completionNotes || null,
        follow_up_task_id: followUpTaskId,
      })
      .eq("id", currentTask.id);

    if (error) {
      console.error("Error completing task:", error);
      return;
    }

    // Notify parent to refresh tasks
    onTaskCompleted();

    // Auto-advance to next task or close if last
    resetCompletionForm();
    if (currentIndex < tasks.length - 1) {
      // Stay at same index - the list will shift
      setCurrentIndex(currentIndex);
    } else {
      // Last task - close modal
      onClose();
    }
  };

  if (!isOpen || tasks.length === 0) return null;
  if (!currentTask) {
    onClose();
    return null;
  }

  const TypeIcon = typeIcons[currentTask.type as TaskType] || ListTodo;
  const isCallRelated = [
    "call",
    "follow_up",
    "phone",
    "meeting",
    "sms",
  ].some((type) => currentTask.type.toLowerCase().includes(type));

  // Outcome options
  const callRelatedOutcomes: Array<{
    value: CompletionOutcome;
    label: string;
    icon: typeof TrendingUp;
    color: string;
  }> = [
    {
      value: "won_deal",
      label: "Won Deal",
      icon: TrendingUp,
      color: "bg-green-100 hover:bg-green-200 text-green-800 border-green-300",
    },
    {
      value: "lost_deal",
      label: "Lost Deal",
      icon: TrendingDown,
      color: "bg-red-100 hover:bg-red-200 text-red-800 border-red-300",
    },
    {
      value: "no_answer",
      label: "No Answer",
      icon: PhoneOff,
      color: "bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300",
    },
    {
      value: "not_interested",
      label: "Not Interested",
      icon: Ban,
      color: "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300",
    },
    {
      value: "rescheduled",
      label: "Rescheduled",
      icon: CalendarIcon,
      color: "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300",
    },
    {
      value: "completed",
      label: "Completed",
      icon: Check,
      color: "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300",
    },
  ];

  const generalOutcomes: Array<{
    value: CompletionOutcome;
    label: string;
    icon: typeof Check;
    color: string;
  }> = [
    {
      value: "completed",
      label: "Completed Successfully",
      icon: CheckCircle2,
      color: "bg-green-100 hover:bg-green-200 text-green-800 border-green-300",
    },
    {
      value: "deferred",
      label: "Deferred / Rescheduled",
      icon: Clock,
      color: "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300",
    },
    {
      value: "cancelled",
      label: "Cancelled / No Longer Needed",
      icon: XCircle,
      color: "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300",
    },
    {
      value: "other",
      label: "Other",
      icon: Check,
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300",
    },
  ];

  const outcomes = isCallRelated ? callRelatedOutcomes : generalOutcomes;
  const showFollowUpDate = selectedOutcome === "rescheduled" || selectedOutcome === "deferred";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500">
                Task {currentIndex + 1} of {tasks.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === tasks.length - 1}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterCustomerOnly}
                onChange={(e) => {
                  setFilterCustomerOnly(e.target.checked);
                  setCurrentIndex(0);
                  resetCompletionForm();
                }}
                className="h-4 w-4 rounded border-slate-300 text-orange-600"
              />
              Customer tasks only
            </label>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Task Details */}
          <div className="rounded-lg border-2 border-slate-200 bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <TypeIcon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900">{currentTask.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {currentTask.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
                {currentTask.customer && (
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Customer:</span> {currentTask.customer.business_name}
                  </p>
                )}
                {currentTask.description && (
                  <p className="mt-3 text-sm text-slate-600">{currentTask.description}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarIcon className="h-4 w-4" />
                Due: {new Date(currentTask.due_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {currentTask.due_time && ` at ${currentTask.due_time}`}
              </div>
              {currentTask.priority && (
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                  currentTask.priority === "urgent" || currentTask.priority === "critical"
                    ? "bg-red-100 text-red-700 border-red-300"
                    : currentTask.priority === "high"
                    ? "bg-orange-100 text-orange-700 border-orange-300"
                    : "bg-slate-100 text-slate-600 border-slate-300"
                }`}>
                  {currentTask.priority.charAt(0).toUpperCase() + currentTask.priority.slice(1)}
                </span>
              )}
            </div>
          </div>

          {/* Completion Form (conditional) */}
          {showingCompletion && (
            <div className="space-y-6 rounded-lg border-2 border-green-300 bg-green-50 p-6">
              <h4 className="text-lg font-bold text-slate-900">Complete Task</h4>

              {/* Outcome Selection */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-900">
                  {isCallRelated ? "Call Outcome" : "Task Outcome"}
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {outcomes.map((outcome) => {
                    const Icon = outcome.icon;
                    const isSelected = selectedOutcome === outcome.value;
                    return (
                      <button
                        key={outcome.value}
                        onClick={() => setSelectedOutcome(outcome.value)}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all ${
                          isSelected
                            ? outcome.color + " border-current ring-2 ring-offset-2"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{outcome.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Status Change (if task has customer) */}
              {currentTask.customer && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Update Customer Status
                  </label>
                  <select
                    value={newCustomerStatus}
                    onChange={(e) => setNewCustomerStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    {customerStatuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Follow-up Date (conditional) */}
              {showFollowUpDate && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Follow-up Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
              )}

              {/* Completion Notes */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    isCallRelated
                      ? "e.g., Customer interested in pricing, will send quote..."
                      : "Add any additional details..."
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              {/* Schedule Next Follow-Up (only if customer) */}
              {currentTask.customer && (
                <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleNext}
                      onChange={(e) => setScheduleNext(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      Schedule Next Follow-Up with {currentTask.customer.business_name}
                    </span>
                  </label>

                  {scheduleNext && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">
                          Task Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={nextTaskTitle}
                          onChange={(e) => setNextTaskTitle(e.target.value)}
                          placeholder="e.g., Follow up on quote"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">Type</label>
                          <select
                            value={nextTaskType}
                            onChange={(e) => setNextTaskType(e.target.value as TaskType)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="call">Call</option>
                            <option value="email">Email</option>
                            <option value="sms">SMS</option>
                            <option value="meeting">Meeting</option>
                            <option value="follow_up">Follow-Up</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">Priority</label>
                          <select
                            value={nextTaskPriority}
                            onChange={(e) => setNextTaskPriority(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Due Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={nextTaskDate}
                            onChange={(e) => setNextTaskDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">Time (Optional)</label>
                          <input
                            type="time"
                            value={nextTaskTime}
                            onChange={(e) => setNextTaskTime(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-6 shrink-0">
          {!showingCompletion ? (
            <>
              <button
                onClick={() => onTaskEdited(currentTask)}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => onTaskDeleted(currentTask.id)}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <div className="flex-1" />
              <button
                onClick={handleCompleteClick}
                className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete Task
              </button>
            </>
          ) : (
            <>
              <button
                onClick={resetCompletionForm}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCompletion}
                disabled={!selectedOutcome}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Save & Continue
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
