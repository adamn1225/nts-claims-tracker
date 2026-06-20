"use client";

import { Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { CoachMessage } from "@/contexts/AiCoachContext";

/**
 * Individual message bubble in the chat
 */

export function AiCoachMessage({ message }: { message: CoachMessage }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === "user";

  // Tag icons and colors
  const tagConfig: Record<
    string,
    { icon: string; label: string; color: string }
  > = {
    SCRIPT: { icon: "📋", label: "Script", color: "text-blue-600" },
    REBUTTAL: { icon: "🛡️", label: "Rebuttal", color: "text-green-600" },
    TIP: { icon: "💡", label: "Tip", color: "text-amber-600" },
    ANSWER: { icon: "✓", label: "Answer", color: "text-slate-600" },
    CLARIFY: { icon: "❓", label: "Clarify", color: "text-purple-600" },
  };

  const tagInfo = message.tag ? tagConfig[message.tag] : null;

  if (isUser) {
    // User message (right-aligned)
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-orange-500 p-4 text-white">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
          <p className="mt-1 text-xs text-orange-100">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    );
  }

  // AI message (left-aligned)
  return (
    <div className="mb-4 flex gap-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-400 to-orange-600">
        <span className="text-sm text-white">🧠</span>
      </div>

      {/* Message bubble */}
      <div className="max-w-[85%]">
        {/* Tag label */}
        {tagInfo && (
          <div className={`mb-1 text-xs font-semibold ${tagInfo.color}`}>
            {tagInfo.icon} {tagInfo.label}
          </div>
        )}

        {/* Web search indicator */}
        {message.webSearchUsed && (
          <div className="mb-2 flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-700">
            <span className="text-sm">🔍</span>
            <span className="font-medium">Live web search via Tavily</span>
          </div>
        )}

        {/* Content */}
        <div
          className={`rounded-2xl rounded-tl-none p-4 ${
            message.tag === "SCRIPT"
              ? "border-2 border-blue-200 bg-blue-50"
              : message.tag === "REBUTTAL"
              ? "border-2 border-green-200 bg-green-50"
              : "bg-slate-100"
          }`}
        >
          {/* Format scripts in monospace for easier reading */}
          <p
            className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-800 ${
              message.tag === "SCRIPT" ? "font-mono" : ""
            }`}
          >
            {message.content}
          </p>

          {/* Low confidence warning */}
          {message.confidence === "low" && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              (mb)
            </div>
          )}

          {/* Copy button */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-semibold text-orange-600 transition-colors hover:text-orange-800"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
