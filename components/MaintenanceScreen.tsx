"use client";

import { useEffect, useState } from "react";
import { Wrench, X } from "lucide-react";
import { brand } from "@/config/app.config";

interface MaintenanceScreenProps {
  message: string | null;
  endsAt: string | null;
  /** When true, renders as an admin preview with a close button overlay. */
  preview?: boolean;
  onClose?: () => void;
}

function getRemaining(endsAt: string | null) {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (isNaN(end)) return null;
  const diff = end - Date.now();
  if (diff <= 0) return { done: true, h: 0, m: 0, s: 0 };
  const totalSeconds = Math.floor(diff / 1000);
  return {
    done: false,
    h: Math.floor(totalSeconds / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function MaintenanceScreen({
  message,
  endsAt,
  preview = false,
  onClose,
}: MaintenanceScreenProps) {
  const [remaining, setRemaining] = useState(() => getRemaining(endsAt));

  useEffect(() => {
    const tick = () => setRemaining(getRemaining(endsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="fixed inset-0 z-100 overflow-y-auto bg-slate-900">
      {preview && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 backdrop-blur-sm">
          <span className="text-xs font-semibold tracking-wide text-amber-300 uppercase">
            Preview — only you can see this
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            <X className="h-4 w-4" /> Close preview
          </button>
        </div>
      )}
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15">
            <Wrench className="h-8 w-8 text-orange-500" />
          </div>

          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            We&apos;ll be right back
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {message?.trim() ||
              `${brand.name} is down for scheduled maintenance. We're making improvements and will be back shortly. Thanks for your patience!`}
          </p>

          {remaining && !remaining.done && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Estimated time remaining
              </p>
              <div className="flex items-center justify-center gap-2 font-mono text-3xl font-bold text-white">
                {remaining.h > 0 && (
                  <>
                    <span className="rounded-lg bg-slate-800 px-3 py-2">
                      {pad(remaining.h)}
                    </span>
                    <span className="text-slate-500">:</span>
                  </>
                )}
                <span className="rounded-lg bg-slate-800 px-3 py-2">
                  {pad(remaining.m)}
                </span>
                <span className="text-slate-500">:</span>
                <span className="rounded-lg bg-slate-800 px-3 py-2">
                  {pad(remaining.s)}
                </span>
              </div>
            </div>
          )}

          {remaining?.done && (
            <p className="mt-6 text-sm font-medium text-orange-400">
              Wrapping up — refresh in a moment to get back in.
            </p>
          )}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-8 text-sm font-medium text-slate-400 underline-offset-4 hover:text-white hover:underline"
        >
          Check if we&apos;re back
        </button>
      </div>
    </div>
  );
}
