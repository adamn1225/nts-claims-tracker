"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * ClockSkewWarning
 *
 * Detects when the user's device clock is significantly out of sync with the
 * server and shows a dismissible banner. An inaccurate local clock is the root
 * cause of "random sign-outs / invalid session" problems (e.g. JJ's Asus
 * laptop), because Supabase auth validates token expiry against the local
 * clock. Telling the user to enable "Set time automatically" resolves it.
 *
 * This is a soft, non-blocking nudge — it never prevents using the app.
 */

// How far off (in seconds) the clock can be before we warn.
const SKEW_THRESHOLD_SECONDS = 120;
const DISMISS_KEY = "nts_clock_skew_dismissed_at";
// Re-show the banner at most once per day after dismissal.
const REDISMISS_MS = 24 * 60 * 60 * 1000;

export default function ClockSkewWarning() {
  const [skewSeconds, setSkewSeconds] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSkew = async () => {
      try {
        // Record the local time immediately around the request to account for
        // network latency, then compare the midpoint against the server clock.
        const before = Date.now();
        const res = await fetch("/api/time", { cache: "no-store" });
        const after = Date.now();
        if (!res.ok) return;

        const body = await res.json().catch(() => null);
        const serverMs = body?.epochMs;
        if (typeof serverMs !== "number" || Number.isNaN(serverMs)) return;

        // Best estimate of local time at the moment the server stamped it.
        const localMidpoint = before + (after - before) / 2;
        const diffSeconds = Math.abs(localMidpoint - serverMs) / 1000;

        if (!cancelled && diffSeconds > SKEW_THRESHOLD_SECONDS) {
          // Respect a recent dismissal.
          const dismissedAt = Number(
            localStorage.getItem(DISMISS_KEY) || "0",
          );
          if (Date.now() - dismissedAt > REDISMISS_MS) {
            setSkewSeconds(Math.round(diffSeconds));
          }
        }
      } catch {
        // Network/parse issues — silently skip; this is only a nudge.
      }
    };

    checkSkew();
    return () => {
      cancelled = true;
    };
  }, []);

  if (skewSeconds === null) return null;

  const minutesOff = Math.max(1, Math.round(skewSeconds / 60));

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
    setSkewSeconds(null);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-60 flex justify-center px-3 pt-2">
      <div className="flex w-full max-w-3xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-md">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1 text-sm text-amber-900">
          <p className="font-semibold">Your device clock looks off by about {minutesOff} minute{minutesOff > 1 ? "s" : ""}.</p>
          <p className="mt-1 text-amber-800">
            This can cause unexpected sign-outs. In Windows, open{" "}
            <strong>Date &amp; time</strong> settings and turn on{" "}
            <strong>Set time automatically</strong> and{" "}
            <strong>Set time zone automatically</strong>. On Mac, enable{" "}
            <strong>Set date and time automatically</strong>.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
