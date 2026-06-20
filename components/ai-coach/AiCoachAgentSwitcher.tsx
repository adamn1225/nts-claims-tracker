"use client";

import { Headset, ShieldCheck } from "lucide-react";
import { useAiCoach, type CoachMode } from "@/contexts/AiCoachContext";

/**
 * Agent switcher shown at the top of the AI panel.
 *
 * Lets admins flip the floating widget between the AI Sales Coach and an
 * admin-only, fully context-aware Admin Assistant. Hidden entirely for
 * non-admins (they only ever see the Sales Coach), so it adds zero clutter
 * for regular brokers.
 */
export function AiCoachAgentSwitcher() {
  const { mode, setMode, isAdmin, isLoading } = useAiCoach();

  // Only admins get the switcher. Also hide it while in page-help mode, which
  // is driven by the separate HelpModal surface.
  if (!isAdmin || mode === "help") return null;

  const options: {
    value: CoachMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { value: "sales", label: "Sales Coach", icon: Headset },
    { value: "admin", label: "Admin Assistant", icon: ShieldCheck },
  ];

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => !active && setMode(opt.value)}
              disabled={isLoading}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "bg-white text-orange-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
