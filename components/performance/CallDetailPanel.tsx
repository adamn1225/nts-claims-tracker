"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  PhoneCall,
  PhoneMissed,
  Clock,
} from "lucide-react";
import type { CallDetailRow, CallScore, AiSentiment } from "./types";
import { formatDuration, formatStartTime } from "./utils";
import { AiScoreCard } from "./AiScoreCard";

const SENTIMENT_CONFIG: Record<
  AiSentiment,
  { label: string; classes: string }
> = {
  positive: {
    label: "Positive",
    classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  neutral: {
    label: "Neutral",
    classes: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  negative: {
    label: "Negative",
    classes: "bg-red-50 text-red-700 ring-red-200",
  },
};

interface CallRowProps {
  call: CallDetailRow;
  score?: CallScore;
  isExpanded: boolean;
  onToggle: () => void;
}

function CallRow({ call, score, isExpanded, onToggle }: CallRowProps) {
  const sentiment = SENTIMENT_CONFIG[call.aiSentiment];
  const isAbandoned = call.outcome === "abandoned";

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-6"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Time */}
          <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">
            {formatStartTime(call.startTime)}
          </span>

          {/* Outcome icon */}
          {isAbandoned ? (
            <PhoneMissed className="h-3.5 w-3.5 shrink-0 text-red-400" />
          ) : (
            <PhoneCall className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          )}

          {/* Queue */}
          <span className="hidden w-36 shrink-0 truncate text-xs text-slate-500 sm:block">
            {call.queue}
          </span>

          {/* Duration */}
          <span className="flex items-center gap-1 text-xs tabular-nums text-slate-600">
            <Clock className="h-3 w-3 shrink-0 text-slate-400" />
            {formatDuration(call.talkDurationSeconds)}
          </span>

          {/* Caller */}
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
            {call.callerName || "Unknown Caller"}
          </span>

          {/* Sentiment badge */}
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${sentiment.classes}`}
          >
            {sentiment.label}
          </span>

          {/* Expand indicator */}
          {score ? (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )
          ) : (
            // Placeholder so layout stays consistent when no score exists
            <span className="h-4 w-4 shrink-0" />
          )}
        </div>
      </button>

      {/* AI Score Card — expanded */}
      {isExpanded && score && (
        <div className="px-4 pb-4 sm:px-6">
          <AiScoreCard score={score} />
        </div>
      )}

      {/* No score placeholder */}
      {isExpanded && !score && (
        <div className="px-4 pb-4 sm:px-6">
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            {/* TODO: Wire to /api/ai/call-score endpoint */}
            AI score not yet available for this call.
          </div>
        </div>
      )}
    </div>
  );
}

interface CallDetailPanelProps {
  agentName: string;
  calls: CallDetailRow[];
  callScores: Record<string, CallScore>;
}

export function CallDetailPanel({ agentName, calls, callScores }: CallDetailPanelProps) {
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const agentCalls = calls
    .filter((c) => c.agentName === agentName)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const toggle = (id: string) =>
    setExpandedCallId((current) => (current === id ? null : id));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Call Log — {agentName}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {agentCalls.length} call{agentCalls.length !== 1 ? "s" : ""} in this
          period. Click a row to expand the AI score card.
        </p>
      </div>

      {agentCalls.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">
          No calls on record for this agent. Import a GoTo call details CSV to populate this view.
        </div>
      ) : (
        <div>
          {agentCalls.map((call) => (
            <CallRow
              key={call.id}
              call={call}
              score={callScores[call.id]}
              isExpanded={expandedCallId === call.id}
              onToggle={() => toggle(call.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
