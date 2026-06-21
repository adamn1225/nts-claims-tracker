"use client";

import Image from "next/image";
import {
  Linkedin,
  MapPin,
  Pencil,
  Phone,
  Truck,
  Trophy,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import type { LevelProgress, TeamMemberStats } from "@/lib/gamification";

export type ProfileHeaderTeamMember = {
  first_name: string | null;
  last_name: string | null;
  office_location: string | null;
  territory: string | null;
  avatar_url: string | null;
  headline: string | null;
  linkedin_url: string | null;
  specialties: string[] | null;
  phone?: string | null;
};

type Props = {
  teamMember: ProfileHeaderTeamMember;
  level: LevelProgress;
  strength: number;
  stats: TeamMemberStats;
  isOwn: boolean;
  onEdit: () => void;
};

function initials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "NT";
}

export default function ProfileHeader({
  teamMember,
  level,
  strength,
  stats,
  isOwn,
  onEdit,
}: Props) {
  const fullName =
    [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") || "TeamMember";

  const summaryStats = [
    { label: "Loads Moved", value: stats.loadsMoved, icon: Truck },
    { label: "Deals Won", value: stats.wonCount, icon: Trophy },
    { label: "Book of Business", value: stats.totalCustomers, icon: BookOpen },
    {
      label: "Tasks Completed",
      value: stats.tasksCompleted,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      {/* Banner */}
      <div className="relative h-28 bg-linear-to-r from-[#1A1A1A] via-[#E85D04] to-[#FFA726] sm:h-36">
        {isOwn && (
          <button
            onClick={onEdit}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit profile
          </button>
        )}
      </div>

      <div className="px-4 pb-6 pt-3 sm:px-8">
        {/* Avatar + identity */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="-mt-12 sm:-mt-16">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl ring-4 ring-white sm:h-32 sm:w-32">
              {teamMember.avatar_url ? (
                <Image
                  src={teamMember.avatar_url}
                  alt={fullName}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#E85D04] to-[#FFA726] text-3xl font-bold text-white">
                  {initials(teamMember.first_name, teamMember.last_name)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 sm:pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                {fullName}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E85D04]/10 px-2.5 py-1 text-xs font-semibold text-[#E85D04]">
                Lvl {level.current.level} · {level.current.title}
              </span>
            </div>

            {teamMember.headline && (
              <p className="mt-1 text-gray-600">{teamMember.headline}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {(teamMember.office_location || teamMember.territory) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {[teamMember.office_location, teamMember.territory]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
              {teamMember.linkedin_url && (
                <a
                  href={teamMember.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#0A66C2] hover:underline"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </a>
              )}
              {teamMember.phone && (
                <a
                  href={`tel:${teamMember.phone}`}
                  className="inline-flex items-center gap-1 font-medium text-[#E85D04] hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {teamMember.phone}
                </a>
              )}
            </div>

            {teamMember.specialties && teamMember.specialties.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {teamMember.specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Level progress */}
        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500">
            <span>{level.xp.toLocaleString()} XP</span>
            {level.next ? (
              <span>
                {level.xpForNextLevel - level.xpIntoLevel} XP to{" "}
                {level.next.title}
              </span>
            ) : (
              <span>Max level reached</span>
            )}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#E85D04] to-[#FFA726] transition-all"
              style={{ width: `${level.percentToNext}%` }}
            />
          </div>
        </div>

        {/* Profile strength */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500">
            <span>Profile strength</span>
            <span
              className={
                strength >= 100 ? "text-[#10B981]" : "text-gray-700"
              }
            >
              {strength}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                strength >= 100 ? "bg-[#10B981]" : "bg-[#1A1A1A]"
              }`}
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryStats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-xl bg-gray-50 p-3 text-center"
              >
                <Icon className="mx-auto h-5 w-5 text-[#E85D04]" />
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {s.value.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
