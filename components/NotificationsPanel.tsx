"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    teamMemberId: string;
    onUnreadCountChange?: (count: number) => void;
}

/**
 * NotificationsPanel — claims-native notification drawer.
 *
 * Reads the `notifications` table (user_id, title, body, link, read_at).
 * `teamMemberId` is actually the auth user id (see app/dashboard/layout.tsx).
 */
export default function NotificationsPanel({
    isOpen,
    onClose,
    teamMemberId,
    onUnreadCountChange,
}: NotificationsPanelProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"unread" | "all">("unread");
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        if (!teamMemberId) return;
        setLoading(true);
        const supabase = createClient();

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", teamMemberId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching notifications:", error);
        } else {
            setNotifications(data || []);
            onUnreadCountChange?.((data || []).filter((n) => !n.read_at).length);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen && teamMemberId) {
            fetchNotifications();

            const supabase = createClient();
            const channel = supabase
                .channel("notifications-changes")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "notifications",
                        filter: `user_id=eq.${teamMemberId}`,
                    },
                    () => fetchNotifications(),
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, teamMemberId]);

    const handleMarkAsRead = async (notificationId: string) => {
        const supabase = createClient();
        await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", notificationId);

        setNotifications((prev) =>
            prev.map((n) =>
                n.id === notificationId
                    ? { ...n, read_at: new Date().toISOString() }
                    : n,
            ),
        );
    };

    const handleMarkAllAsRead = async () => {
        const supabase = createClient();
        await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", teamMemberId)
            .is("read_at", null);

        setNotifications((prev) =>
            prev.map((n) =>
                !n.read_at ? { ...n, read_at: new Date().toISOString() } : n,
            ),
        );
    };

    const handleView = (notification: Notification) => {
        if (!notification.read_at) handleMarkAsRead(notification.id);
        if (notification.link) {
            if (notification.link.startsWith("/")) {
                router.push(notification.link);
            } else {
                window.open(notification.link, "_blank", "noopener");
            }
        }
    };

    const filteredNotifications = notifications.filter((n) =>
        activeTab === "unread" ? !n.read_at : true,
    );

    const unreadCount = notifications.filter((n) => !n.read_at).length;

    const formatTimestamp = (timestamp: string | null) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        const diff = Date.now() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
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
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-slate-100" />
                        <h2 className="text-lg font-semibold text-slate-100">Notifications</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                    <button
                        onClick={() => setActiveTab("unread")}
                        className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "unread"
                                ? "border-b-2 border-primary bg-white text-primary-text"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        Unread
                        {unreadCount > 0 && (
                            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "all"
                                ? "border-b-2 border-primary bg-white text-primary-text"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        All
                        <span className="ml-1.5 text-xs text-slate-500">
                            {notifications.length}
                        </span>
                    </button>
                </div>

                {/* Actions Bar */}
                {activeTab === "unread" && unreadCount > 0 && (
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                        <button
                            onClick={handleMarkAllAsRead}
                            className="text-sm font-medium text-primary-text transition-colors hover:text-primary"
                        >
                            Mark all as read
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto">
                    {loading && filteredNotifications.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-slate-500">Loading…</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
                            <Bell className="mb-3 h-12 w-12 text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">
                                No {activeTab === "unread" ? "unread " : ""}notifications
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {activeTab === "unread"
                                    ? "You're all caught up!"
                                    : "Notifications will appear here"}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`group relative px-4 py-3 transition-colors hover:bg-slate-50 ${!notification.read_at ? "bg-primary/5" : ""
                                        }`}
                                >
                                    {!notification.read_at && (
                                        <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                                    )}

                                    <div className="ml-3">
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

                                        {notification.body && (
                                            <p className="mt-1 text-sm text-slate-700">
                                                {notification.body}
                                            </p>
                                        )}

                                        <div className="mt-2 flex items-center gap-2">
                                            {!notification.read_at && (
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
                                            {notification.link && (
                                                <button
                                                    onClick={() => handleView(notification)}
                                                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                                                >
                                                    View
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
        </>
    );
}
