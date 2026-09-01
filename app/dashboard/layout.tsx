/**
 * Dashboard Layout - Persistent Shell for Application Suite
 *
 * DESIGN PATTERN: Application Shell
 * Reference: Google Material Design, Microsoft Fluent, Modern SaaS patterns
 *
 * LAYOUT STRUCTURE:
 * ┌─────────────┬──────────────────────────┐
 * │             │                          │
 * │   Sidebar   │    Main Content          │
 * │   (260px)   │    (flex-1)              │
 * │             │                          │
 * │  - Logo     │  - Page Header           │
 * │  - Nav      │  - Breadcrumbs           │
 * │  - Modules  │  - Content Area          │
 * │             │                          │
 * └─────────────┴──────────────────────────┘
 *
 * RESPONSIVE BEHAVIOR:
 * - Desktop (1280px+): Persistent sidebar + full content
 * - Tablet (768-1279px): Collapsible sidebar, hamburger menu
 * - Mobile (<768px): Full-screen content, drawer navigation
 */

"use client";

import DashboardNav from "@/components/DashboardNav";
import TopNav from "@/components/TopNav";
import InactivityTimer from "@/components/InactivityTimer";
import NotificationPermissionPrompt from "@/components/NotificationPermissionPrompt";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import ClockSkewWarning from "@/components/ClockSkewWarning";
import MaintenanceGate from "@/components/MaintenanceGate";
import MaintenanceWarningBanner from "@/components/MaintenanceWarningBanner";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { TeamMemberViewProvider } from "@/contexts/TeamMemberViewContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ClickToCallProvider } from "@/contexts/ClickToCallContext";
import { OnlinePresenceProvider } from "@/contexts/OnlinePresenceContext";
import { startNotificationPolling } from "@/lib/notifications/notification-checker";

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabase] = useState(() => createClient());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState<string>("");
  const [showTour, setShowTour] = useState(false);

  // Listen for count updates from NotificationsPanel (fresher data)
  useEffect(() => {
    const handleCountUpdate = (e: CustomEvent<{ count: number }>) => {
      setUnreadCount(e.detail.count);
    };
    window.addEventListener('notifications-count-update', handleCountUpdate as EventListener);
    return () => {
      window.removeEventListener('notifications-count-update', handleCountUpdate as EventListener);
    };
  }, []);

  // Resolve the current user and initialize user-scoped dashboard state.
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setTeamMemberId(user.id);

        // Check tour status - show on first 3 logins
        const tourSkipped = localStorage.getItem("tour-skipped");
        const loginCount = parseInt(
          localStorage.getItem("login-count") || "0",
          10,
        );

        // Increment login count
        const newLoginCount = loginCount + 1;
        localStorage.setItem("login-count", newLoginCount.toString());

        // Show tour if not skipped and within first 3 logins
        if (!tourSkipped && newLoginCount <= 3) {
          // Show tour after a brief delay for UI to render
          setTimeout(() => setShowTour(true), 1500);
        }

      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    void fetchUserData();
  }, [supabase]);

  // Keep the bell badge synchronized with this user's notification rows.
  useEffect(() => {
    if (!teamMemberId) return;

    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", teamMemberId)
        .is("read_at", null);

      if (error) {
        console.error("Error fetching unread notifications:", error);
        return;
      }
      setUnreadCount(count ?? 0);
    };

    void fetchUnreadCount();
    const fallbackPoll = window.setInterval(fetchUnreadCount, 60_000);

    const channel = supabase
      .channel(`notifications-changes:${teamMemberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${teamMemberId}`,
        },
        () => {
          void fetchUnreadCount();
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [supabase, teamMemberId]);

  // Start browser notification polling
  useEffect(() => {
    if (!teamMemberId) return;

    const stopPolling = startNotificationPolling(teamMemberId);

    return stopPolling;
  }, [teamMemberId]);

  const handleTourComplete = () => {
    setShowTour(false);
  };

  const handleTourSkip = () => {
    localStorage.setItem("tour-skipped", "true");
    setShowTour(false);
  };

  const handleTourStart = () => {
    setShowTour(true);
  };

  return (
    <SidebarProvider>
      <TeamMemberViewProvider>
        <ClickToCallProvider>
          <OnlinePresenceProvider>
            <div
              className="flex h-screen overflow-hidden bg-slate-50"
              data-tour="welcome"
            >
              {/* PWA Install Banner - Mobile Only */}
              <PwaInstallBanner />

              {/* Sidebar Navigation - Fixed left on desktop, drawer on mobile */}
              <DashboardNav />

              {/* Top Navigation - Search and notifications */}
              <TopNav
                unreadCount={unreadCount}
                teamMemberId={teamMemberId}
                notificationsPanelOpen={notificationsPanelOpen}
                setNotificationsPanelOpen={setNotificationsPanelOpen}
              />

              {/* Main Content Area - Scrollable with padding for mobile header */}
              <main className="flex-1 overflow-y-auto pt-14 lg:pt-22">
                <DashboardContent>
                  {children}
                </DashboardContent>
              </main>

              {/* Tour Guide */}
              <InactivityTimer />

              {/* Browser Notification Permission Prompt */}
              <NotificationPermissionPrompt />

              {/* Warn if the device clock is skewed (prevents auth sign-outs) */}
              <ClockSkewWarning />

              {/* Advance warning of scheduled maintenance (dismissible) */}
              <MaintenanceWarningBanner />

              {/* Full-screen maintenance page for non-admins when enabled */}
              <MaintenanceGate />
            </div>
          </OnlinePresenceProvider>
        </ClickToCallProvider>
      </TeamMemberViewProvider>
    </SidebarProvider>
  );
}
