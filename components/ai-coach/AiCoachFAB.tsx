"use client";

import { BrainCircuit } from "lucide-react";
import { useAiCoach } from "@/contexts/AiCoachContext";
import { useSidebar } from "@/contexts/SidebarContext";

/**
 * Floating Action Button to open the AI Sales Coach
 * 
 * Dynamic positioning based on sidebar state:
 * - Desktop: Adjusts left position to avoid overlapping sidebar navigation
 * - Mobile: Fixed left-6 position (no sidebar)
 * Shows on all pages - opens in Help mode by default, Sales mode when customer is present.
 */
export function AiCoachFAB() {
  const { isOpen, openCoach, currentCustomer } = useAiCoach();
  const { isCollapsed } = useSidebar();

  // Don't show FAB if coach is already open
  if (isOpen) return null;

  // Dynamic positioning based on sidebar state
  // Collapsed: 80px (64px sidebar + 16px margin)
  // Expanded: 240px (224px sidebar + 16px margin)
  const leftPosition = isCollapsed ? "left-20" : "left-60";

  return (
    <button
      onClick={() => openCoach(currentCustomer)}
      className={`fixed bottom-6 z-50 h-16 w-16 rounded-full bg-linear-to-br from-orange-400 to-orange-600 text-white shadow-2xl shadow-orange-500/40 transition-all duration-300 hover:scale-110 hover:shadow-orange-500/60 active:scale-95 lg:${leftPosition} max-lg:left-6`}
      aria-label="Open AI Sales Coach"
      title={currentCustomer ? "Get sales coaching" : "Get page help"}
    >
      <div className="flex h-full w-full items-center justify-center">
        <BrainCircuit className="h-7 w-7 animate-pulse" />
      </div>

      {/* Pulsing glow ring */}
      <div className="absolute inset-0 -z-10 animate-ping rounded-full bg-orange-500/20" />
    </button>
  );
}
