"use client";

import { Phone, Monitor, Smartphone, X, ExternalLink } from "lucide-react";

interface GoToDeviceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string;
}

export default function GoToDeviceSetupModal({
  isOpen,
  onClose,
  errorMessage,
}: GoToDeviceSetupModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Phone className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              GoTo Device Setup Required
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
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-blue-900">
              How GoTo Click-to-Call Works:
            </h4>
            <ol className="space-y-1.5 text-sm text-blue-700">
              <li className="flex gap-2">
                <span className="font-semibold">1.</span>
                <span>GoTo rings <strong>your phone</strong> first</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">2.</span>
                <span>You answer and hear a dial tone</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">3.</span>
                <span>GoTo connects you to the customer</span>
              </li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">
              Choose ONE active device:
            </h4>

            {/* Desktop App */}
            <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <Monitor className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-slate-900">
                  Desktop Softphone (Recommended)
                </h5>
                <p className="mt-1 text-xs text-slate-600">
                  Download and launch the GoTo Connect desktop app, then sign in with your credentials.
                </p>
                <a
                  href="https://support.goto.com/connect/help/download-goto-connect"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Download GoTo Connect
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Desk Phone */}
            <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-slate-900">
                  Desk Phone
                </h5>
                <p className="mt-1 text-xs text-slate-600">
                  Ensure your desk phone is powered on, connected to the network, and registered with your GoTo account.
                </p>
              </div>
            </div>

            {/* Mobile App */}
            <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                <Smartphone className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-slate-900">
                  Mobile App
                </h5>
                <p className="mt-1 text-xs text-slate-600">
                  Download the GoTo mobile app and sign in. Set it as your active device in the app settings.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <strong>Note:</strong> After launching your device, wait 15-30 seconds for it to fully register with GoTo before trying again.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
