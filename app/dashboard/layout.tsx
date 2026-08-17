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
import TourGuide from "@/components/TourGuide";
import InactivityTimer from "@/components/InactivityTimer";
import NotificationPermissionPrompt from "@/components/NotificationPermissionPrompt";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import ClockSkewWarning from "@/components/ClockSkewWarning";
import MaintenanceGate from "@/components/MaintenanceGate";
import MaintenanceWarningBanner from "@/components/MaintenanceWarningBanner";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeamMemberViewProvider } from "@/contexts/TeamMemberViewContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ClickToCallProvider } from "@/contexts/ClickToCallContext";
import { OnlinePresenceProvider } from "@/contexts/OnlinePresenceContext";
import { dashboardTour } from "@/lib/tour-config";
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
  const router = useRouter();
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState<string>("");
  const [showTour, setShowTour] = useState(false);

  // Listen for count updates from NotificationsPanel (fresher data)
  useEffect(() => {
    const handleCountUpdate = (e: CustomEvent<{ count: number }>) => {
      setUnreadCount(e.detail.count);
      console.log("🔄 Updated badge count from NotificationsPanel:", e.detail.count);
    };
    window.addEventListener('notifications-count-update', handleCountUpdate as EventListener);
    return () => {
      window.removeEventListener('notifications-count-update', handleCountUpdate as EventListener);
    };
  }, []);

  // Fetch user ID and unread notification count
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setTeamMemberId(user.id);
        console.log("🔍 Authenticated user team_member_id:", user.id);

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

        const { count, error, data } = await supabase
          .from("notifications")
          .select("*", { count: "exact" })
          .eq("user_id", user.id)
          .is("read_at", null);

        console.log("📊 Unread notifications query result:", {
          count,
          error,
          data,
        });

        if (!error && count !== null) {
          setUnreadCount(count);
          console.log("✅ Setting unreadCount to:", count);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchUserData();

    // Subscribe to real-time changes for this teamMember only
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
        () => {
          console.log("🔔 Real-time notification change detected, refetching...");
          fetchUserData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Start browser notification polling
  useEffect(() => {
    if (!teamMemberId) return;

    console.log("🔔 Starting notification polling for team member:", teamMemberId);
    const stopPolling = startNotificationPolling(teamMemberId);

    return () => {
      console.log("🔕 Stopping notification polling");
      stopPolling();
    };
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
              <TourGuide
                steps={dashboardTour}
                isOpen={showTour}
                onComplete={handleTourComplete}
                onSkip={handleTourSkip}
                router={router}
              />

              {/* Inactivity Timer - Auto-logout after 1 hour */}
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
