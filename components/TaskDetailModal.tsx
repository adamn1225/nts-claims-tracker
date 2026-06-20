"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import type {
  Task,
  TaskType,
  TaskPriority,
  TaskStatus,
  Customer,
} from "@/lib/types";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  Clock,
  Calendar as CalendarIcon,
  User,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
  Circle,
  ExternalLink,
  Edit,
  Trash2,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Bell,
  Target,
  DollarSign,
  TrendingUp,
  RefreshCw,
  UserPlus,
  MessageCircle,
  Video,
  ListTodo,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  customer?: Customer | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  // Navigation props
  allTasks?: (Task & { customer?: Customer })[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

const typeIcons: Record<TaskType, any> = {
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

const priorityConfig: Record<
  string,
  { bg: string; text: string; border: string; icon: string }
> = {
  urgent: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: "🚨",
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: "⚠️",
  },
  medium: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: "📌",
  },
  low: {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: "ℹ️",
  },
};

const statusConfig: Record<
  TaskStatus,
  { bg: string; text: string; icon: any }
> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700", icon: Circle },
  completed: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: CheckCircle2,
  },
  overdue: { bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
  cancelled: { bg: "bg-slate-100", text: "text-slate-700", icon: Circle },
};

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  customer,
  onEdit,
  onDelete,
  onComplete,
  allTasks,
  currentIndex,
  onNavigate,
}: TaskDetailModalProps) {
  if (!task) return null;

  const TypeIcon = typeIcons[task.type as TaskType] || ListTodo;
  const StatusIcon = statusConfig[task.status as TaskStatus]?.icon || Circle;
  const priority = task.priority || "medium";
  const priorityStyle = priorityConfig[priority];

  const formatDateTime = (date: string, time?: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day);

    const formatted = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    if (!time) return formatted;

    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${formatted} at ${displayHour}:${minutes} ${ampm}`;
  };

  const getDueStatus = () => {
    if (task.status === "completed") return null;

    const now = new Date();
    const [year, month, day] = task.due_date.split("-").map(Number);
    const due = new Date(year, month - 1, day);

    if (task.due_time) {
      const [hours, minutes] = task.due_time.split(":");
      due.setHours(parseInt(hours), parseInt(minutes));
    }

    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return {
        text: "Overdue",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
      };
    }
    if (diffHours < 24) {
      return {
        text: "Due today",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
      };
    }
    if (diffDays === 1) {
      return {
        text: "Due tomorrow",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
      };
    }
    if (diffDays <= 7) {
      return {
        text: `Due in ${diffDays} days`,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
      };
    }
    return null;
  };

  const dueStatus = getDueStatus();

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          {/* Navigation Controls */}
          {hasNavigation && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handlePrevious}
                disabled={!canNavigate}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous task (loops to end)"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs font-medium text-slate-500 px-2">
                {currentIndex + 1} / {allTasks.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!canNavigate}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next task (loops to start)"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="h-6 w-px bg-slate-200 mx-2" />
            </div>
          )}
          
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 shrink-0">
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">
                {task.title}
              </span>
              <span className="font-mono text-xs text-slate-500">
                #{task.id.slice(0, 8)}
              </span>
            </div>
            <div className="text-xs font-normal text-slate-500">
              {task.type
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
            </div>
          </div>
        </div>
      }
      size="2xl"
    >
      <div className="p-6 space-y-6">
        {/* Status & Priority Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg ${statusConfig[task.status as TaskStatus]?.bg || "bg-slate-100"} px-3 py-1.5 text-sm font-medium ${statusConfig[task.status as TaskStatus]?.text || "text-slate-700"}`}
          >
            <StatusIcon className="h-4 w-4" />
            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
          </span>

          {/* Priority Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border ${priorityStyle.bg} ${priorityStyle.border} px-3 py-1.5 text-sm font-medium ${priorityStyle.text}`}
          >
            <span>{priorityStyle.icon}</span>
            {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
          </span>

          {/* Due Status */}
          {dueStatus && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border ${dueStatus.bg} ${dueStatus.border} px-3 py-1.5 text-sm font-medium ${dueStatus.color}`}
            >
              <Clock className="h-4 w-4" />
              {dueStatus.text}
            </span>
          )}
        </div>

        {/* Customer Link (if applicable) */}
        {customer && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Related Customer
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {customer.business_name || getCustomerDisplayName(customer) || "Unknown Customer"}
                  </div>
                  {getCustomerDisplayName(customer) && (
                    <div className="text-sm text-slate-600">
                      {getCustomerDisplayName(customer)}
                    </div>
                  )}
                </div>
              </div>
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Customer
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Due Date & Time */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Due Date
              </div>
              <div className="mt-1 text-slate-900 font-medium">
                {formatDateTime(task.due_date, task.due_time || undefined)}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Description
                </div>
                <div className="text-slate-700 whitespace-pre-wrap">
                  {task.description}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Created
            </div>
            <div className="mt-1 text-sm text-slate-900">
              {task.created_at
                ? new Date(task.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Last Updated
            </div>
            <div className="mt-1 text-sm text-slate-900">
              {task.updated_at
                ? new Date(task.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
          {task.status !== "completed" && onComplete && (
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </button>
          )}

          {onEdit && (
            <button
              onClick={() => {
                onEdit();
                onClose();
              }}
              className={`${task.status === "completed" ? "flex-1" : ""} flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50`}
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
