"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
} from "lucide-react";
import type { AgentSummaryRow } from "./types";
import { formatDuration, highIsGoodColor, lowIsBetterColor } from "./utils";

type SortKey = keyof Pick<
  AgentSummaryRow,
  "handledCalls" | "totalTalkTimeSeconds" | "missedRingPct" | "utilizationPct" | "sentimentPositivePct"
>;

interface Column {
  key: SortKey;
  label: string;
  render: (agent: AgentSummaryRow) => React.ReactNode;
}

const COLUMNS: Column[] = [
  {
    key: "handledCalls",
    label: "Calls",
    render: (a) => (
      <span className="font-semibold text-slate-800 tabular-nums">{a.handledCalls}</span>
    ),
  },
  {
    key: "totalTalkTimeSeconds",
    label: "Avg Talk Time",
    render: (a) => (
      <span className="tabular-nums text-slate-700">
        {a.handledCalls > 0
          ? formatDuration(Math.round(a.totalTalkTimeSeconds / a.handledCalls))
          : "—"}
      </span>
    ),
  },
  {
    key: "missedRingPct",
    label: "Missed %",
    render: (a) => (
      <span className={`tabular-nums font-semibold ${lowIsBetterColor(a.missedRingPct)}`}>
        {a.missedRingPct.toFixed(1)}%
      </span>
    ),
  },
  {
    key: "utilizationPct",
    label: "Utilization",
    render: (a) => (
      <span className={`tabular-nums font-semibold ${highIsGoodColor(a.utilizationPct)}`}>
        {a.utilizationPct}%
      </span>
    ),
  },
  {
    key: "sentimentPositivePct",
    label: "Sentiment",
    render: (a) => (
      <span className={`tabular-nums font-semibold ${highIsGoodColor(a.sentimentPositivePct)}`}>
        {a.sentimentPositivePct}% pos.
      </span>
    ),
  },
];

interface TeamMemberLeaderboardProps {
  agents: AgentSummaryRow[];
  selectedAgent: string | null;
  onSelectAgent: (name: string | null) => void;
}

export function TeamMemberLeaderboard({ agents, selectedAgent, onSelectAgent }: TeamMemberLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("handledCalls");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...agents].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 text-slate-400" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline h-3.5 w-3.5 text-orange-500" />
      : <ChevronDown className="ml-1 inline h-3.5 w-3.5 text-orange-500" />;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Agent Leaderboard</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Click a column header to sort. Select an agent to view call-level detail.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                Agent
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold text-slate-600 hover:text-slate-900"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Calls
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((agent, idx) => {
              const isSelected = selectedAgent === agent.agentName;
              // Use unique key: gotoUserKey if available, otherwise name+index
              const uniqueKey = agent.gotoUserKey || `${agent.agentName}-${idx}`;
              return (
                <tr
                  key={uniqueKey}
                  className={`transition-colors ${
                    isSelected
                      ? "bg-orange-50 ring-1 ring-inset ring-orange-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {/* Rank + Name */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0
                            ? "bg-amber-100 text-amber-700"
                            : idx === 1
                              ? "bg-slate-100 text-slate-600"
                              : idx === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {agent.agentName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-sm">
                      {col.render(agent)}
                    </td>
                  ))}

                  {/* View Calls button */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() =>
                        onSelectAgent(isSelected ? null : agent.agentName)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-orange-500 text-white hover:bg-orange-600"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-600"
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      {isSelected ? "Hide" : "View Calls"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
