"use client";

import { Phone, Clock, PhoneMissed, Activity, MessageSquareDot, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AgentSummaryRow } from "./types";
import { formatDuration, highIsGoodColor, lowIsBetterColor } from "./utils";

type TrendDir = "up" | "down" | "flat";

interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  trend: TrendDir;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  valueColor?: string;
}

function TrendBadge({ dir, label }: { dir: TrendDir; label: string }) {
  const classes =
    dir === "up"
      ? "text-emerald-600"
      : dir === "down"
        ? "text-red-900"
        : "text-slate-400";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  return (
    <span className={`mt-2 flex items-center gap-1 text-xs font-medium ${classes}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

function KpiCard({ label, value, subtext, trend, icon: Icon, iconColor, valueColor = "text-slate-900" }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <p className={`mt-1.5 text-3xl font-bold leading-none tabular-nums ${valueColor}`}>
            {value}
          </p>
          <TrendBadge dir={trend} label={subtext} />
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

interface KpiRowProps {
  agents: AgentSummaryRow[];
}

export function KpiRow({ agents }: KpiRowProps) {
  if (agents.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const totalCalls = agents.reduce((s, a) => s + a.handledCalls, 0);

  const avgTalkSeconds = Math.round(
    agents.reduce(
      (s, a) => s + (a.handledCalls > 0 ? a.totalTalkTimeSeconds / a.handledCalls : 0),
      0,
    ) / agents.length,
  );

  const avgMissedPct = Math.round(
    agents.reduce((s, a) => s + a.missedRingPct, 0) / agents.length,
  );

  const avgUtilPct = Math.round(
    agents.reduce((s, a) => s + a.utilizationPct, 0) / agents.length,
  );

  const avgSentimentPct = Math.round(
    agents.reduce((s, a) => s + a.sentimentPositivePct, 0) / agents.length,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="Total Calls Handled"
        value={totalCalls.toLocaleString()}
        subtext="Across all agents"
        trend="flat"
        icon={Phone}
        iconColor="text-orange-500"
      />
      <KpiCard
        label="Avg Talk Time"
        value={formatDuration(avgTalkSeconds)}
        subtext="Per handled call"
        trend="flat"
        icon={Clock}
        iconColor="text-blue-500"
      />
      <KpiCard
        label="Missed Call %"
        value={`${avgMissedPct.toFixed(1)}%`}
        subtext={avgMissedPct <= 10 ? "Within target" : "Above target"}
        trend={avgMissedPct <= 10 ? "up" : "down"}
        icon={PhoneMissed}
        iconColor={lowIsBetterColor(avgMissedPct).replace("text-", "text-")}
        valueColor={lowIsBetterColor(avgMissedPct)}
      />
      <KpiCard
        label="Avg Utilization"
        value={`${avgUtilPct}%`}
        subtext={avgUtilPct >= 75 ? "On target" : "Below target"}
        trend={avgUtilPct >= 75 ? "up" : "down"}
        icon={Activity}
        iconColor={highIsGoodColor(avgUtilPct).replace("text-", "text-")}
        valueColor={highIsGoodColor(avgUtilPct)}
      />
      <KpiCard
        label="AI Sentiment"
        value={`${avgSentimentPct}%`}
        subtext="Positive calls"
        trend={avgSentimentPct >= 75 ? "up" : "down"}
        icon={MessageSquareDot}
        iconColor={highIsGoodColor(avgSentimentPct).replace("text-", "text-")}
        valueColor={highIsGoodColor(avgSentimentPct)}
      />
    </div>
  );
}
