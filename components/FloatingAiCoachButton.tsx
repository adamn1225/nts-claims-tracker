"use client";

import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { useAiCoach } from "@/contexts/AiCoachContext";

export default function FloatingAiCoachButton() {
  const [isHovered, setIsHovered] = useState(false);
  const { openCoach } = useAiCoach();

  const handleClick = () => {
    // Open AI Coach in "sales" mode without a specific customer
    openCoach(null, "idle", "sales");
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-surface-nav px-5 shadow-lg transition-all duration-200 hover:bg-surface-nav-hover hover:shadow-xl active:scale-95 sm:h-16 sm:px-6"
      aria-label="Open AI Sales Coach"
      data-tour="floating-ai-coach-button"
    >
      <div className="relative">
        <MessageCircle className="h-5 w-5 text-white sm:h-6 sm:w-6" />
        <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
      </div>
      <span
        className={`overflow-hidden text-sm font-medium text-white transition-all duration-200 sm:text-base ${
          isHovered ? "max-w-32" : "max-w-0"
        }`}
      >
        AI Assistant
      </span>
    </button>
  );
}
