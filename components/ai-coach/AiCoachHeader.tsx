"use client";

import { X, MoreVertical, Bot, ExternalLink, Download, Maximize2 } from "lucide-react";
import { useAiCoach } from "@/contexts/AiCoachContext";
import { useState } from "react";

/**
 * Header for AI Coach sidebar with customer context and controls
 */
export function AiCoachHeader({ isPopout = false }: { isPopout?: boolean }) {
  const { closeCoach, currentCustomer, callState, clearConversation, mode, setMode, currentPage, messages } =
    useAiCoach();
  const [showMenu, setShowMenu] = useState(false);

  const contactName =
    currentCustomer?.contact_name ||
    `${currentCustomer?.first_name || ""} ${currentCustomer?.last_name || ""}`.trim() ||
    null;

  const companyInfo = currentCustomer ? [
    currentCustomer.business_name,
    currentCustomer.status,
    currentCustomer.state,
  ]
    .filter(Boolean)
    .join(" • ") : null;

  const callStateDisplay =
    callState === "answered"
      ? { label: "🔴 LIVE", classes: "bg-green-100 text-green-700" }
      : callState === "ringing"
      ? { label: "📞 Ringing", classes: "bg-yellow-100 text-yellow-700" }
      : { label: "Preparing", classes: "bg-slate-100 text-slate-600" };

  // Get page name for help mode
  const getPageName = (path: string): string => {
    if (path.includes("/power-dialer")) return "Power Dialer";
    if (path.includes("/imports")) return "Import/Export";
    if (path.includes("/kanban")) return "Kanban Board";
    if (path.includes("/tasks")) return "Tasks";
    if (path.includes("/calendar")) return "Calendar";
    if (path.includes("/dashboard")) return "Dashboard";
    return "NTS Claims Tracker";
  };

  const handlePopOut = () => {
    // Build URL with conversation context
    const params = new URLSearchParams();
    if (currentCustomer?.id) {
      params.set('customerId', currentCustomer.id);
    }
    
    // Open AI Coach in a new window with context
    const width = 450;
    const height = 800;
    const left = window.screen.width - width - 100;
    const top = 100;
    
    const url = `/ai-coach-window${params.toString() ? '?' + params.toString() : ''}`;
    
    window.open(
      url,
      'AI Sales Coach',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );
    
    // Close the sidebar panel
    closeCoach();
  };

  const handleExportChat = () => {
    if (messages.length === 0) {
      alert("No messages to export");
      return;
    }

    // Format messages as markdown
    const customerInfo = currentCustomer 
      ? `# AI Sales Coach Conversation\n\n**Customer:** ${currentCustomer.business_name || currentCustomer.contact_name}\n**Customer ID:** ${currentCustomer.customer_id}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n`
      : `# AI Sales Coach Conversation\n\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n`;

    const chatContent = messages
      .map((msg) => {
        const role = msg.role === 'user' ? '**You**' : '**AI Coach**';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const tag = msg.tag ? ` [${msg.tag}]` : '';
        return `### ${role}${tag} - ${time}\n\n${msg.content}\n`;
      })
      .join('\n');

    const fullContent = customerInfo + chatContent;

    // Create download
    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-coach-${currentCustomer?.customer_id || 'general'}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setShowMenu(false);
  };

  const handleDockBack = () => {
    // Notify the parent window to open the AI Coach sidebar
    if (window.opener && !window.opener.closed) {
      // Send message to parent window
      window.opener.postMessage({ 
        type: 'DOCK_AI_COACH', 
        customerId: currentCustomer?.id 
      }, window.location.origin);
      
      // Close this pop-out window
      window.close();
    } else {
      alert("Parent window not found. Please return to the main app manually.");
    }
  };

  return (
    <div className="shrink-0 border-b border-orange-200 bg-linear-to-r from-orange-50 to-amber-50 p-4">
      {/* Top row: Close + Title + Pop-out/Dock + Menu */}
      <div className="mb-3 flex items-center justify-between">
        {/* Close button - only show in sidebar mode */}
        {!isPopout && (
          <button
            onClick={closeCoach}
            className="text-slate-600 transition-colors hover:text-slate-900"
            aria-label="Close coach"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        
        {/* Title - take up space on left if no close button */}
        {isPopout && <div className="w-5" />}

        <div className="flex-1 text-center">
          <h3 className="text-base font-bold text-slate-900">
            {mode === "admin" ? "AI Admin Assistant" : "AI Sales Coach"}
          </h3>
        </div>

        {/* Pop-out button (sidebar mode) OR Dock-back button (pop-out mode) */}
        {!isPopout ? (
          <button
            onClick={handlePopOut}
            className="text-slate-600 transition-colors hover:text-slate-900 mr-2"
            aria-label="Pop out to new window"
            title="Open in new window"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleDockBack}
            className="text-slate-600 transition-colors hover:text-slate-900 mr-2"
            aria-label="Dock back to main window"
            title="Dock back to main app"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-slate-600 transition-colors hover:text-slate-900"
            aria-label="Menu"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-xl">
                <button
                  onClick={handleExportChat}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Export Chat
                </button>
                <button
                  onClick={() => {
                    clearConversation();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Clear Conversation
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context Display */}
      {currentCustomer ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              🎯 Coaching for: {contactName || "Customer"}
            </p>
            <span
              className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${callStateDisplay.classes}`}
            >
              {callStateDisplay.label}
            </span>
          </div>
          {companyInfo && (
            <p className="text-xs text-slate-600">{companyInfo}</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-600" />
            <p className="text-sm font-medium text-purple-900">
               {getPageName(currentPage)}
            </p>
          </div>
          <p className="mt-1 text-xs text-purple-700">
            General sales coaching • Use "research" or "find info" for live web searches
          </p>
        </div>
      )}
    </div>
  );
}
