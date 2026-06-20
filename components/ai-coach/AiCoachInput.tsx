"use client";

import { useState, useRef } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { useAiCoach } from "@/contexts/AiCoachContext";

/**
 * Input area at bottom of coach sidebar
 */

const SALES_SUGGESTIONS = [
  "How do I build rapport fast?",
  "What if they say 'not interested'?",
  "Re-engagement opening script",
  "Discovery questions to qualify this lead",
  "Research this company's shipping needs",
  "Should I follow up by email or call?",
];

const HELP_SUGGESTIONS = [
  "How do I use this page?",
  "What are the keyboard shortcuts?",
  "Show me best practices for this feature",
  "What's the workflow for this page?",
  "Tips for using this more efficiently",
];

export function AiCoachInput() {
  const { sendMessage, isLoading, mode } = useAiCoach();
  const [input, setInput] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Choose suggestions based on mode
  const suggestions = mode === "sales" ? SALES_SUGGESTIONS : HELP_SUGGESTIONS;

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    // Cycle to next suggestion
    setSuggestionIndex((prev) => (prev + 1) % suggestions.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = () => {
    setInput(suggestions[suggestionIndex]);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white p-4">
      {/* Input field */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "sales"
              ? "Ask about scripts, objections, or research this customer..."
              : "Ask about this page, features, or workflows..."
          }
          className="max-h-30 min-h-11 grow resize-none rounded-xl border-2 border-slate-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          rows={2}
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="shrink-0 rounded-xl bg-orange-500 p-3 text-white transition-all hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          aria-label="Send message"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Smart suggestion */}
      {!isLoading && input.trim() === "" && (
        <button
          onClick={handleSuggestionClick}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Try: &quot;{suggestions[suggestionIndex]}&quot;
        </button>
      )}

      {/* Keyboard hint */}
      <p className="mt-1 text-center text-xs text-slate-400">
        Press Enter to send • Shift+Enter for new line
      </p>
    </div>
  );
}
