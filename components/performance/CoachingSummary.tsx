"use client";

import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import type { CallDetailRow, CallScore } from "./types";
import { computeCoachingStats, highIsGoodColor } from "./utils";

interface ProgressBarProps {
  value: number; // 0–100
  colorClass: string;
}

function ProgressBar({ value, colorClass }: ProgressBarProps) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${colorClass.replace("text-", "bg-")}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: number;
  suffix?: string;
  goodThreshold?: number;
  warnThreshold?: number;
}

function MetricRow({ label, value, suffix = "%", goodThreshold = 75, warnThreshold = 50 }: MetricRowProps) {
  const color = highIsGoodColor(value, goodThreshold, warnThreshold);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className={`font-semibold tabular-nums ${color}`}>
          {value}{suffix}
        </span>
      </div>
      <ProgressBar value={value} colorClass={color} />
    </div>
  );
}

interface CoachingSummaryProps {
  agentName: string;
  calls: CallDetailRow[];
  callScores: Record<string, CallScore>;
}

export function CoachingSummary({ agentName, calls, callScores }: CoachingSummaryProps) {
  const agentCalls = calls.filter((c) => c.agentName === agentName);
  const stats = computeCoachingStats(agentCalls, callScores);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Coaching Summary — {agentName}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Based on {stats.totalScored} scored call{stats.totalScored !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="p-6">
        {stats.totalScored === 0 ? (
          <p className="text-sm text-slate-400">
            No scored calls available yet. Import call data and connect the AI scoring endpoint to see coaching metrics.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Key metrics */}
            <div className="space-y-4">
              <MetricRow
                label="Discovery Rate"
                value={stats.discoveryRate}
                goodThreshold={70}
                warnThreshold={40}
              />
              <MetricRow
                label="Closing Attempt Rate (quote calls)"
                value={stats.closingAttemptRate}
                goodThreshold={65}
                warnThreshold={40}
              />
              <MetricRow
                label="Avg Call Quality Score"
                value={stats.avgScore}
                suffix="/100"
                goodThreshold={75}
                warnThreshold={55}
              />
            </div>

            {/* Verdict breakdown */}
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Call Verdict Breakdown
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-center ring-1 ring-emerald-100">
                  <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                  <p className="mt-1 text-xl font-bold text-emerald-700">
                    {stats.strongCount}
                  </p>
                  <p className="text-[11px] text-emerald-600">Strong</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-center ring-1 ring-amber-100">
                  <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" />
                  <p className="mt-1 text-xl font-bold text-amber-700">
                    {stats.needsCoachingCount}
                  </p>
                  <p className="text-[11px] text-amber-600">Needs Coaching</p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-center ring-1 ring-red-100">
                  <AlertCircle className="mx-auto h-4 w-4 text-red-500" />
                  <p className="mt-1 text-xl font-bold text-red-700">
                    {stats.criticalCount}
                  </p>
                  <p className="text-[11px] text-red-600">Critical</p>
                </div>
              </div>
            </div>

            {/* Focus areas */}
            {(stats.criticalCount > 0 || stats.needsCoachingCount > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800">
                  Recommended Coaching Focus
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-700">
                  {stats.discoveryRate < 50 && (
                    <li>Discovery questions — agent skipping qualification on most calls</li>
                  )}
                  {stats.closingAttemptRate < 50 && (
                    <li>Closing technique — low attempt rate on quote calls</li>
                  )}
                  {stats.criticalCount > 0 && (
                    <li>
                      {stats.criticalCount} critical call{stats.criticalCount !== 1 ? "s" : ""} flagged — review recordings
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
