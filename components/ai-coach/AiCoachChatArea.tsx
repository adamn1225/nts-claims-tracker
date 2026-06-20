"use client";

import { useAiCoach } from "@/contexts/AiCoachContext";
import { AiCoachMessage } from "./AiCoachMessage";
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";

/**
 * Scrollable chat area showing conversation history
 */
export function AiCoachChatArea() {
  const { messages, isLoading, mode } = useAiCoach();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom ONLY when a new message is added
  useEffect(() => {
    // Only scroll if message count increased (new message added)
    if (messages.length > prevMessageCountRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  return (
    <div className="space-y-4 p-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
          <Sparkles className="mb-2 h-12 w-12 text-slate-300" />
          <p className="font-medium">Ask me anything!</p>
          <p className="mt-1 text-sm">
            {mode === "admin" ? (
              <>
                Try: &quot;How do I schedule maintenance?&quot; or &quot;Walk me
                through this page&quot;
              </>
            ) : (
              <>
                Try: &quot;Give me a re-engagement script&quot; or &quot;They say
                we&apos;re too expensive&quot;
              </>
            )}
          </p>
        </div>
      )}

      {messages.map((message) => (
        <AiCoachMessage key={message.id} message={message} />
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mb-4 flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-400 to-orange-600">
            <span className="text-sm text-white">🧠</span>
          </div>
          <div className="flex w-fit gap-1 rounded-2xl rounded-tl-none bg-slate-100 p-3">
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-orange-500"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-orange-500"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-orange-500"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
