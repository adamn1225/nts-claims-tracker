"use client";

import { Phone, Settings, X, ExternalLink } from "lucide-react";
import Link from "next/link";

interface GoToConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoToConnectModal({
  isOpen,
  onClose,
}: GoToConnectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Phone className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Connect GoTo Phone
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600">
            To use click-to-call, connect your GoTo Connect account. This
            enables one-click dialing directly from any customer card.
          </p>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-800">
              How to connect:
            </h4>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                  1
                </span>
                Go to Settings &rarr; GoTo Integration
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                  2
                </span>
                Click &ldquo;Connect GoTo Account&rdquo;
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                  3
                </span>
                Sign in with your GoTo credentials
              </li>
            </ol>
          </div>

          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="text-sm font-semibold text-blue-800">
              How click-to-call works:
            </h4>
            <ul className="space-y-1.5 text-sm text-blue-700">
              <li className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>Your phone rings first (desk phone or GoTo app)</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>When you answer, GoTo connects you to the customer</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">•</span>
                <span className="font-semibold">
                  The GoTo Connect app must be running OR your desk phone must be online
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <Link
            href="/dashboard/settings"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <Settings className="h-4 w-4" />
            Go to Settings
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
