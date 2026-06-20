"use client";

import { useState, useEffect } from "react";
import { X, Check, Archive, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification, Task, Customer } from "@/lib/types";
import TaskDetailModal from "./TaskDetailModal";

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  brokerId: string;
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  brokerId,
  onUnreadCountChange,
}: NotificationsPanelProps) {
  const [activeTab, setActiveTab] = useState<"unread" | "read" | "archived">(
    "unread",
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Fetch notifications from Supabase
  const fetchNotifications = async () => {
    if (!brokerId) return;

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("broker_id", brokerId)
      .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`) // Only show if not scheduled or time has arrived
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
    } else {
      setNotifications(data || []);
      // Update parent's badge count with fresh data
      const freshUnreadCount = (data || []).filter(
        (n) => !n.is_read && !n.is_archived
      ).length;
      onUnreadCountChange?.(freshUnreadCount);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && brokerId) {
      fetchNotifications();

      // Subscribe to real-time updates
      const supabase = createClient();
      const channel = supabase
        .channel("notifications-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `broker_id=eq.${brokerId}`,
          },
          () => {
            fetchNotifications();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, brokerId]);

  const handleMarkAsRead = async (notificationId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
    } else {
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n,
        ),
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("broker_id", brokerId)
      .eq("is_read", false)
      .eq("is_archived", false);

    if (error) {
      console.error("Error marking all as read:", error);
    } else {
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) =>
          !n.is_read
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n,
        ),
      );
    }
  };

  const handleArchive = async (notificationId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_archived: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Error archiving notification:", error);
    } else {
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_archived: true } : n,
        ),
      );
    }
  };

  const handleView = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    const supabase = createClient();

    // Fetch task if task_id exists
    if (notification.task_id) {
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", notification.task_id)
        .single();

      if (task && !taskError) {
        setViewingTask(task);

        // Fetch customer if task has customer_id
        if (task.customer_id) {
          const { data: customer } = await supabase
            .from("customers")
            .select("*")
            .eq("id", task.customer_id)
            .single();

          if (customer) {
            setViewingCustomer(customer);
          }
        }
      }
    } else if (notification.customer_id) {
      // Navigate to customer page
      window.location.href = `/dashboard/customers/${notification.customer_id}`;
    } else if (notification.link_url) {
      window.open(notification.link_url, "_blank");
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return !n.is_read && !n.is_archived;
    if (activeTab === "read") return n.is_read && !n.is_archived;
    if (activeTab === "archived") return n.is_archived;
    return false;
  });

  const unreadCount = notifications.filter(
    (n) => !n.is_read && !n.is_archived,
  ).length;

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Unknown time";
    // Parse as UTC and convert to local time for display
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} Minute${minutes !== 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} Hour${hours !== 1 ? "s" : ""} ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} Day${days !== 1 ? "s" : ""} ago`;

    // For older dates, show in local time format
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl sm:w-96 lg:w-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-[#28323d]">
          <div className="flex items-center gap-2 ">
            <Bell className="h-5 w-5 text-slate-100" />
            <h2 className="text-lg font-semibold text-slate-100">
              Notifications
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab("unread")}
            className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "unread"
                ? "border-b-2 border-orange-500 bg-white text-orange-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("read")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "read"
                ? "border-b-2 border-orange-500 bg-white text-orange-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Read
            <span className="ml-1.5 text-xs text-slate-500">
              {notifications.filter((n) => n.is_read && !n.is_archived).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "archived"
                ? "border-b-2 border-orange-500 bg-white text-orange-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Archived
            <span className="ml-1.5 text-xs text-slate-500">
              {notifications.filter((n) => n.is_archived).length}
            </span>
          </button>
        </div>

        {/* Actions Bar */}
        {activeTab === "unread" && unreadCount > 0 && (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm font-medium text-orange-600 transition-colors hover:text-orange-700"
            >
              Mark all as read
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
              <Bell className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                No {activeTab} notifications
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activeTab === "unread"
                  ? "You're all caught up!"
                  : "Notifications you've " + activeTab + " will appear here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative px-4 py-3 transition-colors hover:bg-slate-50 ${
                    !notification.is_read ? "bg-orange-50/30" : ""
                  }`}
                >
                  {/* Unread Indicator */}
                  {!notification.is_read && (
                    <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-500" />
                  )}

                  <div className="ml-3">
                    {/* Header */}
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-500">
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatTimestamp(notification.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Message */}
                    <p className="mt-1 text-sm text-slate-700">
                      {notification.message}
                    </p>

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-2">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                        >
                          <Check className="h-3 w-3" />
                          Read
                        </button>
                      )}
                      {(notification.task_id ||
                        notification.customer_id ||
                        notification.link_url) && (
                        <button
                          onClick={() => handleView(notification)}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          View
                        </button>
                      )}
                      {!notification.is_archived && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(notification.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <Archive className="h-3 w-3" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={!!viewingTask}
        onClose={() => {
          setViewingTask(null);
          setViewingCustomer(null);
        }}
        task={viewingTask}
        customer={viewingCustomer}
        onEdit={() => {
          // For now, just close - could navigate to tasks page
          setViewingTask(null);
          setViewingCustomer(null);
          window.location.href = "/dashboard/tasks";
        }}
        onDelete={async () => {
          if (viewingTask) {
            const supabase = createClient();
            await supabase
              .from("tasks")
              .update({ status: "cancelled" })
              .eq("id", viewingTask.id);
            setViewingTask(null);
            setViewingCustomer(null);
          }
        }}
        onComplete={async () => {
          if (viewingTask) {
            const supabase = createClient();
            await supabase
              .from("tasks")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("id", viewingTask.id);
            setViewingTask(null);
            setViewingCustomer(null);
          }
        }}
      />
    </>
  );
}
