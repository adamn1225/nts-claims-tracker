"use client";

import { Bell, HelpCircle, MessageSquare } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import NotificationsPanel from "@/components/NotificationsPanel";
import FeedbackPanel from "@/components/FeedbackPanel";
import HelpModal from "@/components/HelpModal";
import TeamMemberSelector from "@/components/TeamMemberSelector";
import RoleViewSwitcher from "@/components/RoleViewSwitcher";

interface TopNavProps {
    onNotificationClick?: () => void;
    unreadCount?: number;
    searchPlaceholder?: string;
    teamMemberId: string;
    notificationsPanelOpen: boolean;
    setNotificationsPanelOpen: (open: boolean) => void;
}

export default function TopNav({
    unreadCount = 0,
    teamMemberId,
    notificationsPanelOpen,
    setNotificationsPanelOpen,
}: TopNavProps) {
    const pathname = usePathname();
    const { isCollapsed } = useSidebar();

    const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
    const [helpModalOpen, setHelpModalOpen] = useState(false);

    return (
        <>
            <div
                className={`fixed left-0 right-0 top-0 z-30 border-b border-slate-200 bg-white drop-shadow transition-all duration-300 ${isCollapsed ? "lg:left-16" : "lg:left-52"
                    }`}
            >
                <div className="flex items-center justify-between px-6 pt-3 pb-5">
                    {/* Left spacer (search removed with sales-tracker) */}
                    <div className="flex-1" />

                    {/* Right Actions */}
                    <div className="ml-4 flex items-center gap-3 h-full">
                        {/* Admin-only demo role view switcher */}
                        <RoleViewSwitcher />

                        {/* TeamMember Selector */}
                        <TeamMemberSelector />

                        {/* Help Button */}
                        <button
                            onClick={() => setHelpModalOpen(true)}
                            className="flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800/90"
                            aria-label="Quick Help"
                            data-tour="help-button"
                        >
                            <HelpCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Help</span>
                        </button>

                        {/* Feedback Button */}
                        <button
                            onClick={() => setFeedbackPanelOpen(true)}
                            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-3 my-0 py-5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
                            aria-label="Send Feedback"
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden sm:inline">Feedback</span>
                        </button>

                        {/* Notification Bell */}
                        <button
                            data-testid="notification-bell"
                            data-tour="notifications"
                            onClick={() => setNotificationsPanelOpen(true)}
                            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-800 transition-colors hover:bg-slate-100"
                            aria-label="Notifications"
                        >
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <>
                                    <span className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                                    </span>
                                    <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white shadow-lg ring-2 ring-white">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Notifications Panel */}
            <NotificationsPanel
                isOpen={notificationsPanelOpen}
                onClose={() => setNotificationsPanelOpen(false)}
                teamMemberId={teamMemberId}
                onUnreadCountChange={(count) => {
                    window.dispatchEvent(
                        new CustomEvent("notifications-count-update", {
                            detail: { count },
                        }),
                    );
                }}
            />

            {/* Help Modal */}
            <HelpModal
                isOpen={helpModalOpen}
                onClose={() => setHelpModalOpen(false)}
                currentPath={pathname || "/dashboard"}
            />

            {/* Feedback Panel */}
            <FeedbackPanel
                isOpen={feedbackPanelOpen}
                onClose={() => setFeedbackPanelOpen(false)}
            />
        </>
    );
}
