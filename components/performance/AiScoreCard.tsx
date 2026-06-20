"use client";

import {
  CheckCircle2,
  XCircle,
  Tag,
  Search,
  Zap,
  Target,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Minus,
} from "lucide-react";
import type { CallScore, QualityRating, CallScoreVerdict } from "./types";

// TODO: Wire to /api/ai/call-score endpoint

interface BadgeProps {
  label: string;
  variant: "pass" | "fail" | "good" | "excellent" | "poor" | "info" | "neutral";
}

function Badge({ label, variant }: BadgeProps) {
  const classes: Record<BadgeProps["variant"], string> = {
    pass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    fail: "bg-red-50 text-red-700 ring-red-200",
    good: "bg-amber-50 text-amber-700 ring-amber-200",
    excellent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    poor: "bg-red-50 text-red-700 ring-red-200",
    info: "bg-blue-50 text-blue-700 ring-blue-200",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${classes[variant]}`}
    >
      {label}
    </span>
  );
}

function qualityBadge(rating: QualityRating): BadgeProps {
  const map: Record<QualityRating, BadgeProps> = {
    excellent: { label: "Excellent", variant: "excellent" },
    good: { label: "Good", variant: "good" },
    poor: { label: "Poor", variant: "poor" },
  };
  return map[rating];
}

function callTypeLabel(type: CallScore["callType"]): string {
  const map: Record<CallScore["callType"], string> = {
    quote: "Quote",
    customer_service: "Customer Service",
    junk: "Junk",
  };
  return map[type];
}

function callTypeBadgeVariant(type: CallScore["callType"]): BadgeProps["variant"] {
  if (type === "quote") return "info";
  if (type === "customer_service") return "neutral";
  return "fail";
}

interface CriterionRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge: BadgeProps;
}

function CriterionRow({ icon: Icon, label, badge }: CriterionRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <Badge label={badge.label} variant={badge.variant} />
    </div>
  );
}

const VERDICT_CONFIG: Record<
  CallScoreVerdict,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  strong: {
    label: "Strong Performance",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    icon: TrendingUp,
  },
  needs_coaching: {
    label: "Needs Coaching",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical — Immediate Coaching Required",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: XCircle,
  },
};

interface AiScoreCardProps {
  score: CallScore;
}

export function AiScoreCard({ score }: AiScoreCardProps) {
  const verdict = VERDICT_CONFIG[score.overallVerdict];
  const VerdictIcon = verdict.icon;

  const scoreBarColor =
    score.overallScore >= 80
      ? "bg-emerald-500"
      : score.overallScore >= 60
        ? "bg-amber-400"
        : "bg-red-500";

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          AI Call Analysis
        </p>
        {/* TODO: Wire to /api/ai/call-score endpoint */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Score</span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">
            {score.overallScore}/100
          </span>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="h-1.5 w-full rounded-none bg-slate-100">
        <div
          className={`h-full rounded-none transition-all ${scoreBarColor}`}
          style={{ width: `${score.overallScore}%` }}
        />
      </div>

      {/* Criteria rows */}
      <div className="divide-y divide-slate-50 px-4">
        <CriterionRow
          icon={score.isValid ? CheckCircle2 : XCircle}
          label="Valid Call"
          badge={score.isValid ? { label: "Valid", variant: "pass" } : { label: "Not Valid", variant: "fail" }}
        />
        <CriterionRow
          icon={Tag}
          label="Call Type"
          badge={{ label: callTypeLabel(score.callType), variant: callTypeBadgeVariant(score.callType) }}
        />
        <CriterionRow
          icon={Search}
          label="Discovery Performed"
          badge={
            score.discoveryPerformed
              ? { label: "Yes", variant: "pass" }
              : { label: "No", variant: "fail" }
          }
        />
        <CriterionRow
          icon={Zap}
          label="Discovery Quality"
          badge={qualityBadge(score.discoveryQuality)}
        />
        <CriterionRow
          icon={Target}
          label="Closing Skills"
          badge={qualityBadge(score.closingSkills)}
        />
        <CriterionRow
          icon={CheckSquare}
          label="Clear Next Steps Set"
          badge={
            score.clearNextSteps
              ? { label: "Yes", variant: "pass" }
              : { label: "No", variant: "fail" }
          }
        />
      </div>

      {/* Verdict banner */}
      <div
        className={`mx-3 mb-3 mt-3 flex items-center gap-2.5 rounded-md border px-3 py-2.5 ${verdict.bg}`}
      >
        <VerdictIcon className={`h-4 w-4 shrink-0 ${verdict.text}`} />
        <span className={`text-sm font-semibold ${verdict.text}`}>{verdict.label}</span>
        <span className={`ml-auto text-xs font-normal ${verdict.text} opacity-75`}>
          {score.overallScore}/100 pts
        </span>
      </div>
    </div>
  );
}
