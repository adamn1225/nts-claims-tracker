"use client";

/**
 * Notification Checker
 * Polls for due notifications and triggers browser notifications
 * Runs in the background when user is logged in
 */

import { createClient } from "@/lib/supabase/client";
import {
  showBrowserNotification,
  areNotificationsEnabled,
} from "./browser-notifications";

// Track which notifications we've already shown
const shownNotifications = new Set<string>();

// Rate limiting: Track last notification time
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Check if we can show a notification (rate limiting)
 */
function canShowNotification(): boolean {
  const now = Date.now();
  const timeSinceLastNotification = now - lastNotificationTime;
  return timeSinceLastNotification >= NOTIFICATION_COOLDOWN;
}

/**
 * Check for due notifications and show browser notifications
 * Rate limited to one notification per 30 minutes
 */
export async function checkAndShowDueNotifications(teamMemberId: string) {
  if (!teamMemberId || !areNotificationsEnabled()) {
    return;
  }

  const supabase = createClient();

  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", teamMemberId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching notifications:", error);
      return;
    }

    if (!notifications || notifications.length === 0) {
      return;
    }

    // Rate limiting: Only show notifications if cooldown period has passed
    if (!canShowNotification()) {
      return;
    }

    // Filter out notifications we've already shown
    const newNotifications = notifications.filter(
      (n) => !shownNotifications.has(n.id)
    );

    if (newNotifications.length === 0) {
      return;
    }

    const notification = newNotifications[0];

    // Show browser notification for the most important one
    const browserNotification = await showBrowserNotification(notification.title, {
      body: notification.body ?? undefined,
      tag: `notification-${notification.id}`,
      requireInteraction: notification.type === "task_reminder",
      data: {
        notificationId: notification.id,
        link: notification.link,
        totalUnreadCount: newNotifications.length,
      },
    });

    if (browserNotification && notification.link?.startsWith("/")) {
      browserNotification.onclick = () => {
        window.focus();
        window.location.assign(notification.link!);
        browserNotification.close();
      };
    }

    // Mark as shown and update last notification time
    shownNotifications.add(notification.id);
    lastNotificationTime = Date.now();

    // If there are more notifications, mention it in console
    if (newNotifications.length > 1) {
      console.log(`📬 ${newNotifications.length - 1} more notifications available in the app`);
    }
  } catch (error) {
    console.error("Error in checkAndShowDueNotifications:", error);
  }
}

/**
 * Start polling for due notifications
 * Returns a cleanup function to stop polling
 */
export function startNotificationPolling(teamMemberId: string): () => void {
  if (!teamMemberId) {
    return () => { };
  }

  // Check immediately
  checkAndShowDueNotifications(teamMemberId);

  // Then check every minute
  const intervalId = setInterval(() => {
    checkAndShowDueNotifications(teamMemberId);
  }, 60 * 1000); // Every 60 seconds

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Clear the shown notifications cache
 * (useful when user marks all as read)
 */
export function clearShownNotificationsCache() {
  shownNotifications.clear();
}

/**
 * Reset the notification cooldown timer
 * (useful for testing or manual notification triggers)
 */
export function resetNotificationCooldown() {
  lastNotificationTime = 0;
}

/**
 * Get time remaining until next notification can be shown (in milliseconds)
 */
export function getTimeUntilNextNotification(): number {
  const now = Date.now();
  const timeSinceLastNotification = now - lastNotificationTime;
  const remaining = NOTIFICATION_COOLDOWN - timeSinceLastNotification;
  return Math.max(0, remaining);
}
