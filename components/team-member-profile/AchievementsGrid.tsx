"use client";

import { useState } from "react";
import {
  Trophy,
  Handshake,
  CloudRain,
  BookOpen,
  CheckCircle2,
  Camera,
  Truck,
  Linkedin,
  Star,
  Award,
  PhoneOutgoing,
  PhoneCall,
  TrendingUp,
  LayoutGrid,
  Images,
  MessageSquare,
  Headphones,
  UserCircle2,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import type { Achievement, AchievementTier } from "@/lib/gamification";

const ICONS: Record<string, LucideIcon> = {
  Trophy,
  Handshake,
  CloudRain,
  BookOpen,
  CheckCircle2,
  Camera,
  Truck,
  Linkedin,
  Star,
  Award,
  PhoneOutgoing,
  PhoneCall,
  TrendingUp,
  LayoutGrid,
  Images,
  MessageSquare,
  Headphones,
  UserCircle2,
};

const TIER_STYLES: Record<
  AchievementTier,
  { ring: string; bg: string; text: string }
> = {
  bronze: {
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  silver: {
    ring: "ring-slate-200",
    bg: "bg-slate-50",
    text: "text-slate-600",
  },
  gold: {
    ring: "ring-[#FFA726]/40",
    bg: "bg-[#FFA726]/10",
    text: "text-[#E85D04]",
  },
};

const PAGE_SIZE = 9;

export default function AchievementsGrid({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const [expanded, setExpanded] = useState(false);
  const earned = achievements.filter((a) => a.earned).length;
  const visible = expanded ? achievements : achievements.slice(0, PAGE_SIZE);
  const hasMore = achievements.length > PAGE_SIZE;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Award className="h-5 w-5 text-[#E85D04]" />
          Achievements
        </h2>
        <span className="text-sm font-medium text-gray-500">
          {earned}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {visible.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const tier = TIER_STYLES[a.tier];
          return (
            <div
              key={a.id}
              title={a.description}
              className={`flex flex-col items-center rounded-xl p-3 text-center ring-1 transition ${
                a.earned
                  ? `${tier.bg} ${tier.ring}`
                  : "bg-gray-50 ring-gray-100 opacity-60"
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  a.earned ? "bg-white" : "bg-gray-100"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    a.earned ? tier.text : "text-gray-400"
                  }`}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-gray-900">
                {a.name}
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-gray-500">
                {a.description}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              View all {achievements.length} badges
            </>
          )}
        </button>
      )}
    </section>
  );
}
