"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";

interface MaintenanceStatus {
  maintenanceEnabled: boolean;
  message: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

const POLL_MS = 60000;
const DISMISS_KEY = "nts_maintenance_warning_dismissed";

function getCountdown(startsAt: string) {
  const start = new Date(startsAt).getTime();
  if (isNaN(start)) return null;
  const diff = start - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
}

function formatLabel(c: { h: number; m: number; s: number }) {
  if (c.h >= 24) {
    const days = Math.floor(c.h / 24);
    const hrs = c.h % 24;
    return `${days}d ${hrs}h`;
  }
  if (c.h > 0) return `${c.h}h ${c.m}m`;
  if (c.m > 0) return `${c.m}m ${String(c.s).padStart(2, "0")}s`;
  return `${c.s}s`;
}

/**
 * Floating, dismissible advance-warning banner shown to all users when
 * maintenance is scheduled (startsAt is in the future) but not yet active.
 * Positioned top-right so it never covers the bottom-right chat widget.
 */
export default function MaintenanceWarningBanner() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{
    h: number;
    m: number;
    s: number;
  } | null>(null);

  useEffect(() => {
    try {
      setDismissedFor(localStorage.getItem(DISMISS_KEY));
    } catch {
      // ignore
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance", { cache: "no-store" });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Live countdown tick
  useEffect(() => {
    if (!status?.startsAt || status.maintenanceEnabled) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(getCountdown(status.startsAt as string));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.startsAt, status?.maintenanceEnabled]);

  const handleDismiss = () => {
    if (!status?.startsAt) return;
    try {
      localStorage.setItem(DISMISS_KEY, status.startsAt);
    } catch {
      // ignore
    }
    setDismissedFor(status.startsAt);
  };

  // Conditions to show
  if (!status || status.maintenanceEnabled || !status.startsAt) return null;
  if (!countdown) return null;
  if (dismissedFor === status.startsAt) return null;

  const startLabel = new Date(status.startsAt).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="fixed top-20 right-4 z-50 w-[calc(100%-2rem)] max-w-xs sm:w-80">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-lg">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Scheduled maintenance
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              The app will go down in{" "}
              <span className="font-semibold">{formatLabel(countdown)}</span>{" "}
              (around {startLabel}).
            </p>
            {status.message && (
              <p className="mt-1 truncate text-xs text-amber-700">
                {status.message}
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss maintenance warning"
            className="-mr-1 -mt-1 rounded p-1 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
