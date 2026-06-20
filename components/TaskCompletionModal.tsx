"use client";

import { useState } from "react";
import { Task, TaskType, Customer } from "@/lib/types";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
  PhoneOff,
  Ban,
  Calendar,
  Check,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface TaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (
    outcome: string,
    notes: string,
    followUpDate?: string,
    nextTask?: {
      title: string;
      type: TaskType;
      due_date: string;
      due_time?: string;
      priority?: string;
    }
  ) => Promise<void>;
  task: Task | null;
  customer?: Customer;
  // Navigation props
  allTasks?: (Task & { customer?: Customer })[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
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

export default function TaskCompletionModal({
  isOpen,
  onClose,
  onComplete,
  task,
  customer,
  allTasks,
  currentIndex,
  onNavigate,
}: TaskCompletionModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<CompletionOutcome | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  
  // Schedule next follow-up state
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextTaskTitle, setNextTaskTitle] = useState("");
  const [nextTaskType, setNextTaskType] = useState<TaskType>("follow_up");
  const [nextTaskDate, setNextTaskDate] = useState(new Date().toISOString().split("T")[0]); // Default to today
  const [nextTaskTime, setNextTaskTime] = useState("");
  const [nextTaskPriority, setNextTaskPriority] = useState<string>("medium");

  if (!isOpen || !task) return null;

  // Navigation logic (circular - loops back to start/end)
  const hasNavigation = allTasks && allTasks.length > 0 && currentIndex !== undefined && onNavigate;
  const canNavigate = hasNavigation && allTasks.length > 1;

  const handlePrevious = () => {
    if (hasNavigation && onNavigate) {
      if (currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else {
        // At first task - loop to last task
        onNavigate(allTasks.length - 1);
      }
    }
  };

  const handleNext = () => {
    if (hasNavigation && onNavigate) {
      if (currentIndex < allTasks.length - 1) {
        onNavigate(currentIndex + 1);
      } else {
        // At last task - loop to first task
        onNavigate(0);
      }
    }
  };

  // Determine if this is a call/follow-up related task
  const isCallRelated = [
    "call",
    "follow_up",
    "phone",
    "meeting",
    "sms",
  ].some((type) => task.type.toLowerCase().includes(type));

  // Outcome options based on task type
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
      icon: Calendar,
      color: "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300",
    },
    {
      value: "other",
      label: "Other",
      icon: Check,
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300",
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

  const handleSubmit = async () => {
    // Allow submission without outcome selection (minimal validation)
    // if (!selectedOutcome) return;
    
    // If rescheduled/deferred, require a follow-up date
    if ((selectedOutcome === "rescheduled" || selectedOutcome === "deferred") && !followUpDate) {
      alert("Please select a follow-up date");
      return;
    }

    // If scheduling next task, validate fields
    if (scheduleNext && customer) {
      if (!nextTaskDate || !nextTaskTitle.trim()) {
        alert("Please provide a title and date for the next task");
        return;
      }
    }

    // Prepare next task data if scheduling
    const nextTask = scheduleNext && customer && nextTaskDate && nextTaskTitle.trim()
      ? {
          title: nextTaskTitle.trim(),
          type: nextTaskType,
          due_date: nextTaskDate,
          due_time: nextTaskTime || undefined,
          priority: nextTaskPriority,
        }
      : undefined;

    // Wait for completion to finish before navigating
    await onComplete(selectedOutcome || "other", completionNotes, followUpDate || undefined, nextTask);
    
    // Reset form
    setSelectedOutcome(null);
    setCompletionNotes("");
    setFollowUpDate("");
    setScheduleNext(false);
    setNextTaskTitle("");
    setNextTaskType("follow_up");
    setNextTaskDate("");
    setNextTaskTime("");
    setNextTaskPriority("medium");

    // Auto-advance to next task if navigation is enabled
    if (hasNavigation && onNavigate) {
      if (currentIndex < allTasks.length - 1) {
        // Move to next task
        onNavigate(currentIndex + 1);
      } else {
        // Last task - loop back to first task
        onNavigate(0);
      }
    } else {
      // No navigation - just close modal
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedOutcome(null);
    setCompletionNotes("");
    setFollowUpDate("");
    setScheduleNext(false);
    setNextTaskTitle("");
    setNextTaskType("follow_up");
    setNextTaskDate("");
    setNextTaskTime("");
    setNextTaskPriority("medium");
    onClose();
  };

  const showFollowUpDate = selectedOutcome === "rescheduled" || selectedOutcome === "deferred";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 shrink-0">
          <div className="flex-1">
            {/* Navigation Controls */}
            {hasNavigation && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handlePrevious}
                  disabled={!canNavigate}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous task (loops to end)"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-medium text-slate-500 px-2">
                  Task {currentIndex + 1} / {allTasks.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!canNavigate}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next task (loops to start)"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
            <h2 className="text-xl font-bold text-slate-900">
              {selectedOutcome === "won_deal" || selectedOutcome === "completed" 
                ? "Congratulations!" 
                : "Complete Task"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {selectedOutcome === "won_deal" 
                ? `Amazing work! You closed a deal with ${customer?.business_name || "this customer"}!`
                : selectedOutcome === "completed"
                ? "Great job completing this task! Keep the momentum going."
                : task.title}
              {customer && !selectedOutcome && (
                <span className="ml-2 text-slate-500">
                  • {customer.business_name || getCustomerDisplayName(customer) || "Unknown"}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6 overflow-y-auto flex-1">
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
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                A new follow-up task will be created for this date
              </p>
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
              rows={4}
              placeholder={
                isCallRelated
                  ? "e.g., Customer interested in pricing for quarterly shipments, will send quote..."
                  : "Add any additional details about the outcome..."
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Schedule Next Follow-Up (only if task has customer) */}
          {customer && (
            <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleNext}
                  onChange={(e) => setScheduleNext(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-900">
                  Schedule Next Follow-Up with {customer.business_name || getCustomerDisplayName(customer) || "this customer"}
                </span>
              </label>

              {scheduleNext && (
                <div className="mt-4 space-y-3">
                  {/* Task Title */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Task Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nextTaskTitle}
                      onChange={(e) => setNextTaskTitle(e.target.value)}
                      placeholder="e.g., Follow up on quote, Check in on shipment"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Task Type & Priority */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Type
                      </label>
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
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Priority
                      </label>
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

                  {/* Date & Time */}
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
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Time (Optional)
                      </label>
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

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-6 shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all ${
              selectedOutcome === "won_deal" || selectedOutcome === "completed"
                ? "bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-200"
                : "bg-slate-600 hover:bg-slate-700"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {selectedOutcome === "won_deal" 
                ? "🎉 Mark as Won" 
                : selectedOutcome === "completed" 
                ? "✅ Mark Complete" 
                : "Complete Task"}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
