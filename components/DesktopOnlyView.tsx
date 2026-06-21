/**
 * DesktopOnlyView Component
 * 
 * Displays a user-friendly message for pages that are too complex for mobile devices.
 * Follows NTS brand design with orange accent (#E85D04) and professional freight logistics aesthetic.
 * 
 * USAGE:
 * - Complex admin panels
 * - Kanban boards on mobile
 * - Map-heavy interfaces
 * - Multi-column data tables
 * 
 * @param mobileAlternative - Optional link to mobile-friendly alternative
 * @param pageName - Name of the current page (e.g., "Kanban Board")
 * @param reason - Optional explanation why desktop is required
 */

"use client";

import { Monitor, Smartphone, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DesktopOnlyViewProps {
  pageName?: string;
  reason?: string;
  mobileAlternative?: {
    href: string;
    label: string;
  };
}

export default function DesktopOnlyView({
  pageName = "This Page",
  reason,
  mobileAlternative,
}: DesktopOnlyViewProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* Icon Display */}
        <div className="mx-auto mb-6 flex items-center justify-center gap-4">
          <div className="rounded-full bg-white p-4 shadow-md">
            <Smartphone className="h-8 w-8 text-slate-400" />
          </div>
          <ArrowRight className="h-6 w-6 text-slate-300" />
          <div className="rounded-full bg-primary p-4 shadow-lg">
            <Monitor className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="mb-3 text-2xl font-bold text-slate-900">
          Desktop Required
        </h1>

        {/* Message */}
        <p className="mb-2 text-base text-slate-600">
          {pageName} is optimized for desktop screens.
        </p>

        {reason && (
          <p className="mb-6 text-sm text-slate-500">
            {reason}
          </p>
        )}

        {!reason && (
          <p className="mb-6 text-sm text-slate-500">
            Please access this page from a desktop or laptop computer for the best experience.
          </p>
        )}

        {/* Mobile Alternative Link */}
        {mobileAlternative && (
          <Link
            href={mobileAlternative.href}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white shadow-md transition-all hover:bg-primary-text hover:shadow-lg active:scale-95"
          >
            {mobileAlternative.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {/* NTS Branding */}
        <div className="mt-12 border-t border-slate-200 pt-6">
          <p className="text-xs font-medium text-slate-400">
            NTS Claims Tracker
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Freight Claims Management
          </p>
        </div>
      </div>
    </div>
  );
}
