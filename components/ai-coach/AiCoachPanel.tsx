"use client";

import { useAiCoach } from "@/contexts/AiCoachContext";
import { AiCoachHeader } from "./AiCoachHeader";
import { AiCoachAgentSwitcher } from "./AiCoachAgentSwitcher";
import { AiCoachQuickActions } from "./AiCoachQuickActions";
import { AiCoachChatArea } from "./AiCoachChatArea";
import { AiCoachInput } from "./AiCoachInput";

/**
 * Main AI Coach Panel - slide-in sidebar from right
 * 
 * Desktop: 400px sidebar
 * Tablet/Mobile: Bottom sheet or fullscreen overlay
 * 
 * NOTE: This panel only renders for "sales" mode (Power Dialer).
 * When mode is "help", the HelpModal handles rendering the AI assistant inline.
 */
export function AiCoachPanel() {
  const { isOpen, closeCoach, mode } = useAiCoach();

  // Only render for "sales" mode - "help" mode is handled by HelpModal
  if (!isOpen || mode === "help") return null;

  return (
    <>
      {/* Backdrop overlay - no blur so users can reference page content */}
      <div
        className="fixed inset-0 z-60 bg-black/5 transition-opacity"
        onClick={closeCoach}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div className="fixed right-0 top-0 z-70 flex h-screen w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-100">
        <AiCoachHeader />
        <AiCoachAgentSwitcher />
        <AiCoachQuickActions />
        <div className="grow overflow-y-auto">
          <AiCoachChatArea />
        </div>
        <AiCoachInput />
      </div>
    </>
  );
}
