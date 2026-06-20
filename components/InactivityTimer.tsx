"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, X } from "lucide-react";

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
const WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before logout

export default function InactivityTimer() {
  const router = useRouter();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(5 * 60); // 5 minutes in seconds

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
  };

  const logout = async () => {
    clearTimers();
    await supabase.auth.signOut();
    router.push("/auth/login?reason=inactivity");
  };

  const startCountdown = () => {
    setTimeRemaining(5 * 60); // Reset to 5 minutes

    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const showWarningModal = () => {
    setShowWarning(true);
    startCountdown();

    // Auto-logout after 5 minutes if no activity
    timeoutRef.current = setTimeout(() => {
      logout();
    }, WARNING_TIME);
  };

  const resetTimer = () => {
    clearTimers();
    setShowWarning(false);

    // Set warning to show 5 minutes before logout
    warningTimeoutRef.current = setTimeout(() => {
      showWarningModal();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);
  };

  useEffect(() => {
    // Activity events to track
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      if (showWarning) {
        // If warning is showing and user is active, reset everything
        resetTimer();
      } else {
        // Normal activity - just reset the timers
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // Cleanup on unmount
    return () => {
      clearTimers();
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [showWarning]); // Re-run when showWarning changes

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStayLoggedIn = () => {
    resetTimer();
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl mx-4">
        {/* Close button */}
        <button
          onClick={handleStayLoggedIn}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Still there?
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            You've been inactive for a while. You'll be automatically logged out in:
          </p>
          <p className="text-xs text-slate-500 mb-4">
            (The timer continues even if you close your browser)
          </p>

          {/* Countdown */}
          <div className="mb-6">
            <div className="text-4xl font-bold text-[#E85D04] tabular-nums">
              {formatTime(timeRemaining)}
            </div>
            <div className="text-xs text-slate-500 mt-1">minutes remaining</div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={logout}
              className="flex-1 rounded-lg border-2 border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Log out now
            </button>
            <button
              onClick={handleStayLoggedIn}
              className="flex-1 rounded-lg bg-[#E85D04] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C74E03]"
            >
              Stay logged in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
