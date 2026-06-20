"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  saveNotificationPreference,
  getNotificationPreference,
} from "@/lib/notifications/browser-notifications";

/**
 * Prompt user to enable browser notifications
 * Shows once per session if not already enabled
 */
export default function NotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Only show in browser
    if (typeof window === "undefined") return;

    // Don't show if already dismissed this session
    const dismissedThisSession = sessionStorage.getItem(
      "notificationPromptDismissed",
    );
    if (dismissedThisSession === "true") return;

    // Don't show if not supported
    if (!isNotificationSupported()) return;

    // Don't show if already decided
    const permission = getNotificationPermission();
    if (permission !== "default") return;

    // Don't show if user previously declined
    const preference = getNotificationPreference();
    if (preference === false) return;

    // Show prompt after 2 seconds (let user settle in first)
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setIsRequesting(true);

    const permission = await requestNotificationPermission();

    if (permission === "granted") {
      await saveNotificationPreference(true);
      setShowPrompt(false);
    } else {
      await saveNotificationPreference(false);
      setShowPrompt(false);
    }

    setIsRequesting(false);
  };

  const handleDismiss = async () => {
    sessionStorage.setItem("notificationPromptDismissed", "true");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in">
      <div className="rounded-lg border border-orange-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Enable Notifications
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Get instant alerts for upcoming tasks and follow-ups. You can
              change this anytime in settings.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleEnable}
                disabled={isRequesting}
                className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {isRequesting ? "Requesting..." : "Enable"}
              </button>
              <button
                onClick={handleDismiss}
                disabled={isRequesting}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Not Now
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            disabled={isRequesting}
            className="text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
