"use client";

/**
 * Browser Notification System
 * Handles permission requests and notification delivery
 */

export type NotificationPermissionState = "granted" | "denied" | "default";

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) {
    console.warn("Browser does not support notifications");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

/**
 * Show a browser notification
 */
export async function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
): Promise<Notification | null> {
  if (!isNotificationSupported()) {
    console.warn("Browser does not support notifications");
    return null;
  }

  const permission = getNotificationPermission();

  if (permission === "denied") {
    console.warn("Notification permission denied");
    return null;
  }

  if (permission === "default") {
    const newPermission = await requestNotificationPermission();
    if (newPermission !== "granted") {
      return null;
    }
  }

  try {
    const notification = new Notification(title, {
      icon: "/icon-192.png", // TODO: Add app icon
      badge: "/icon-192.png",
      ...options,
    });

    return notification;
  } catch (error) {
    console.error("Error showing notification:", error);
    return null;
  }
}

/**
 * Show task reminder notification
 */
export async function showTaskReminder(
  taskTitle: string,
  dueTime: string,
  customerName?: string,
): Promise<void> {
  const body = customerName
    ? `Task for ${customerName} - Due at ${dueTime}`
    : `Due at ${dueTime}`;

  await showBrowserNotification(taskTitle, {
    body,
    tag: `task-reminder-${Date.now()}`,
    requireInteraction: true, // Keep notification visible until user interacts
  });
}

/**
 * Show follow-up reminder notification
 */
export async function showFollowUpReminder(
  customerName: string,
  followUpType: string,
): Promise<void> {
  await showBrowserNotification(`Follow-up: ${customerName}`, {
    body: `Time for scheduled ${followUpType}`,
    tag: `follow-up-${Date.now()}`,
    requireInteraction: true,
  });
}

/**
 * Save user's notification preference
 */
export async function saveNotificationPreference(
  enabled: boolean,
): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem("browserNotificationsEnabled", enabled.toString());
  }
}

/**
 * Get user's notification preference
 */
export function getNotificationPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = localStorage.getItem("browserNotificationsEnabled");
  return stored === "true";
}

/**
 * Check if notifications are enabled and permission granted
 */
export function areNotificationsEnabled(): boolean {
  return (
    getNotificationPreference() && getNotificationPermission() === "granted"
  );
}
