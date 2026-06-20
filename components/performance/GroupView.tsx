"use client";

import { Users, Phone, PhoneMissed, Clock, TrendingUp, TrendingDown } from "lucide-react";
import type { GroupSummary } from "./types";
import { formatDuration } from "./utils";

interface GroupViewProps {
  groups: GroupSummary[];
  onSelectGroup: (groupName: string) => void;
  selectedGroup: string | null;
}

function StatCell({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${colorClass ?? "text-slate-800"}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

export function GroupView({ groups, onSelectGroup, selectedGroup }: GroupViewProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-400">
          No group data yet. Agents are automatically grouped by their office location.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Assign office locations in SalesTrack or via Agent Config below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Groups by Office Location</h2>
        <p className="text-sm text-slate-500">
          Click a group to see individual agent detail for that location.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const isSelected = selectedGroup === group.groupName;
          const missedColor =
            group.missedRingPct > 15
              ? "text-red-600"
              : group.missedRingPct > 10
                ? "text-amber-600"
                : "text-green-600";

          return (
            <button
              key={group.groupName}
              onClick={() => onSelectGroup(isSelected ? "" : group.groupName)}
              className={`rounded-xl border p-5 text-left transition-all hover:shadow-md ${
                isSelected
                  ? "border-orange-300 bg-orange-50 shadow-md ring-2 ring-orange-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{group.groupName}</h3>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3 w-3" />
                    <span>{group.agentCount} {group.agentCount === 1 ? "agent" : "agents"}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                    Active
                  </span>
                )}
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3">
                <StatCell
                  label="Handled"
                  value={String(group.handledCalls)}
                  sub="calls"
                />
                <StatCell
                  label="Missed"
                  value={`${group.missedRingPct}%`}
                  colorClass={missedColor}
                />
                <StatCell
                  label="Avg Talk"
                  value={group.avgTalkTimeSeconds > 0 ? formatDuration(group.avgTalkTimeSeconds) : "—"}
                />
              </div>

              {/* Top / bottom agent hint */}
              {group.agentCount > 1 && (
                <div className="mt-4 flex flex-col gap-1 border-t border-slate-100 pt-3">
                  {group.topAgent && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700">
                      <TrendingUp className="h-3 w-3 shrink-0" />
                      <span className="font-medium">Top:</span>
                      <span className="truncate">{group.topAgent}</span>
                    </div>
                  )}
                  {group.bottomAgent && group.bottomAgent !== group.topAgent && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700">
                      <TrendingDown className="h-3 w-3 shrink-0" />
                      <span className="font-medium">Focus:</span>
                      <span className="truncate">{group.bottomAgent}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
