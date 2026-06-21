"use client";

import {
  PhoneCall,
  MessageSquare,
  RefreshCw,
  PhoneMissed,
  CircleDollarSign,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Wrench,
  Users,
  Mail,
  Megaphone,
  BarChart3,
} from "lucide-react";
import { useAiCoach } from "@/contexts/AiCoachContext";
import { useState, useEffect } from "react";

/**
 * Quick action buttons for preset prompts
 */

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  category?: string;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    id: "opening",
    label: "Opening Script",
    icon: PhoneCall,
    prompt: "Generate a warm opening script for this call",
  },
  {
    id: "objection",
    label: "Handle Objection",
    icon: MessageSquare,
    prompt: "Customer says price is too high — how do I respond?",
  },
  {
    id: "close",
    label: "Close Deal",
    icon: CircleDollarSign,
    prompt: "Generate a closing script for this conversation",
  },
  {
    id: "re-engage",
    label: "Re-engage",
    icon: RefreshCw,
    prompt: "Haven't talked in months — how do I reconnect?",
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: HelpCircle,
    prompt: "What questions should I ask to understand their shipping needs?",
  },
  {
    id: "no-answer",
    label: "No Answer",
    icon: PhoneMissed,
    prompt: "They didn't answer — what should I do for follow-up?",
  },
];

const ADMIN_ACTIONS: QuickAction[] = [
  {
    id: "this-page",
    label: "Explain this page",
    icon: HelpCircle,
    prompt: "What can I do on the page I'm currently on? Walk me through the key admin controls.",
  },
  {
    id: "maintenance",
    label: "Maintenance mode",
    icon: Wrench,
    prompt: "How do I schedule and enable maintenance mode, and notify users?",
  },
  {
    id: "teamMembers",
    label: "Manage team members",
    icon: Users,
    prompt: "How do I add, deactivate, or change roles/permissions for team members?",
  },
  {
    id: "email",
    label: "Email broadcast",
    icon: Mail,
    prompt: "How do I send an email broadcast or daily digest to the team?",
  },
  {
    id: "updates",
    label: "Post an update",
    icon: Megaphone,
    prompt: "How do I create an App Update announcement for the dashboard?",
  },
  {
    id: "analytics",
    label: "Read analytics",
    icon: BarChart3,
    prompt: "Help me interpret the company and team member activity analytics.",
  },
];

export function AiCoachQuickActions() {
  const { sendMessage, isLoading, mode } = useAiCoach();
  const [showMore, setShowMore] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aiCoachQuickActionsCollapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('aiCoachQuickActionsCollapsed', String(newState));
  };

  const actions = mode === "admin" ? ADMIN_ACTIONS : DEFAULT_ACTIONS;
  const visibleActions = showMore ? actions : actions.slice(0, 4);

  const handleActionClick = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white">
      {/* Collapse/Expand Toggle Bar */}
      <button
        onClick={toggleCollapsed}
        className="group flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
        aria-label={isCollapsed ? "Expand quick actions" : "Collapse quick actions"}
      >
        <span className="flex items-center gap-2">
          <span className="text-orange-600">⚡</span>
          Quick Actions
        </span>
        <div className="flex items-center justify-center rounded-full bg-orange-100 p-1.5 transition-all group-hover:bg-orange-100">
          {isCollapsed ? (
            <ChevronDown className="h-5 w-5 text-slate-600 group-hover:text-orange-600 transition-colors" />
          ) : (
            <ChevronUp className="h-5 w-5 text-slate-600 group-hover:text-orange-600 transition-colors" />
          )}
        </div>
      </button>

      {/* Quick Action Buttons */}
      {!isCollapsed && (
        <div className="p-3 pt-0">
          <div className="flex flex-wrap gap-2">
            {visibleActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action.prompt)}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2.5 text-sm font-medium text-orange-800 shadow-sm transition-all hover:bg-orange-200 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  title={action.prompt}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </button>
              );
            })}

            {/* More button */}
            {actions.length > 4 && (
              <button
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95"
              >
                {showMore ? "Less" : "More"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
