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
    // Fetch notifications that are:
    // 1. Not read
    // 2. Not archived
    // 3. Either not scheduled OR scheduled for now/past
    const now = new Date().toISOString();

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("team_member_id", teamMemberId)
      .eq("is_read", false)
      .eq("is_archived", false)
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
      .order("created_at", { ascending: false })
      .limit(10); // Only check recent notifications

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

    // Only show ONE notification at a time (the most urgent one)
    // Priority: task_reminder > follow_up > other
    const priorityOrder = ["task_reminder", "follow_up", "overdue", "general"];
    const sortedNotifications = [...newNotifications].sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.type) !== -1 
        ? priorityOrder.indexOf(a.type) 
        : 999;
      const bPriority = priorityOrder.indexOf(b.type) !== -1 
        ? priorityOrder.indexOf(b.type) 
        : 999;
      return aPriority - bPriority;
    });

    const notification = sortedNotifications[0];

    // Show browser notification for the most important one
    await showBrowserNotification(notification.title, {
      body: notification.message,
      tag: `notification-${notification.id}`,
      requireInteraction: notification.type === "task_reminder", // Task reminders stay visible
      data: {
        notificationId: notification.id,
        taskId: notification.task_id,
        customerId: notification.customer_id,
        totalUnreadCount: newNotifications.length, // Let user know there are more
      },
    });

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
    return () => {};
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
