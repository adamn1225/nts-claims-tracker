"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  saveNotificationPreference,
  getNotificationPreference,
  showBrowserNotification,
} from "@/lib/notifications/browser-notifications";
import toast from "react-hot-toast";

/**
 * Notification settings component for user preferences
 * Can be used in a settings modal or dedicated settings page
 */
export default function NotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<
    "granted" | "denied" | "default"
  >("default");
  const [enabled, setEnabled] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSupported(isNotificationSupported());
      setPermission(getNotificationPermission());
      setEnabled(getNotificationPreference());
    }
  }, []);

  const handleToggle = async () => {
    if (!supported) {
      toast.error("Browser notifications not supported");
      return;
    }

    if (!enabled) {
      // User wants to enable notifications
      setIsRequesting(true);

      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      if (newPermission === "granted") {
        await saveNotificationPreference(true);
        setEnabled(true);
        toast.success("Notifications enabled!");

        // Show test notification
        setTimeout(() => {
          showBrowserNotification("Notifications Enabled", {
            body: "You'll now receive browser notifications for tasks and follow-ups.",
            tag: "test-notification",
          });
        }, 500);
      } else {
        toast.error(
          "Permission denied. Please enable notifications in your browser settings.",
        );
      }

      setIsRequesting(false);
    } else {
      // User wants to disable notifications
      await saveNotificationPreference(false);
      setEnabled(false);
      toast.success("Notifications disabled");
    }
  };

  const handleTestNotification = async () => {
    if (permission !== "granted") {
      toast.error("Please enable notifications first");
      return;
    }

    await showBrowserNotification("Test Notification", {
      body: "This is how task reminders will appear",
      tag: "test-notification",
      requireInteraction: false,
    });

    toast.success("Test notification sent!");
  };

  if (!supported) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="h-5 w-5 text-slate-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Notifications Not Supported
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Your browser doesn't support push notifications. Please use a
              modern browser like Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Notification Toggle */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                enabled ? "bg-orange-100" : "bg-slate-100"
              }`}
            >
              {enabled ? (
                <Bell className="h-5 w-5 text-orange-600" />
              ) : (
                <BellOff className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Browser Notifications
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Receive instant alerts for upcoming tasks and follow-ups
              </p>
              {permission === "granted" && enabled && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-700">
                  <Check className="h-3 w-3" />
                  <span>Enabled and working</span>
                </div>
              )}
              {permission === "denied" && (
                <p className="mt-2 text-xs text-red-600">
                  Permission denied. Please enable in browser settings.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={isRequesting || permission === "denied"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-orange-500" : "bg-slate-300"
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Test Notification Button */}
      {enabled && permission === "granted" && (
        <button
          onClick={handleTestNotification}
          className="w-full rounded-lg border-2 border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
        >
          Send Test Notification
        </button>
      )}

      {/* Help Text */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <p>
          <strong>How it works:</strong> When enabled, you'll receive browser
          notifications for:
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li>Tasks due soon (based on your reminder settings)</li>
          <li>Upcoming follow-ups with customers</li>
          <li>Important deadlines</li>
        </ul>
        <p className="mt-2">
          You'll still receive email notifications based on your email
          preferences.
        </p>
      </div>
    </div>
  );
}
