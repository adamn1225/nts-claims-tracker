"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Loader2, Search, Users } from "lucide-react";

type BrokerCard = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  office_location: string | null;
  territory: string | null;
  // Profile columns added by the broker-profiles migration — may be null/absent
  // before the migration is run.
  avatar_url?: string | null;
  headline?: string | null;
  specialties?: string[] | null;
};

function initials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "NT";
}

// Offices in preferred display order; any unlisted location falls to the end.
const OFFICE_ORDER = [
  "Fort Lauderdale, FL",
  "Fort Myers, FL",
  "Fort Pierce, FL",
  "Doral, FL",
  "Orlando, FL",
  "Tampa, FL",
  "West Palm Beach, FL",
  "Jacksonville, FL",
  "Cleveland, OH",
  "Raleigh, NC",
  "Florence, KY",
];

function sortOffices(offices: string[]): string[] {
  return [...offices].sort((a, b) => {
    const ai = OFFICE_ORDER.indexOf(a);
    const bi = OFFICE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function BrokerDirectoryPage() {
  const supabase = createClient() as unknown as SupabaseClient;
  const [brokers, setBrokers] = useState<BrokerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("brokers")
        .select(
          "id, email, first_name, last_name, office_location, territory, avatar_url, headline, specialties",
        )
        .eq("is_active", true)
        .eq("show_in_directory", true)
        .order("first_name", { ascending: true });
      if (error) console.error("Directory fetch error:", error);
      setBrokers((data as BrokerCard[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = brokers.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.first_name?.toLowerCase().includes(q) ||
      b.last_name?.toLowerCase().includes(q) ||
      b.office_location?.toLowerCase().includes(q) ||
      b.territory?.toLowerCase().includes(q) ||
      b.headline?.toLowerCase().includes(q) ||
      b.specialties?.some((s) => s.toLowerCase().includes(q))
    );
  });

  // Group by office_location
  const grouped: Record<string, BrokerCard[]> = {};
  for (const b of filtered) {
    const office = b.office_location || "Other";
    if (!grouped[office]) grouped[office] = [];
    grouped[office].push(b);
  }
  const officeKeys = sortOffices(Object.keys(grouped));
  // Move "Other" to end
  const otherIdx = officeKeys.indexOf("Other");
  if (otherIdx > -1) officeKeys.push(...officeKeys.splice(otherIdx, 1));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-6 w-6 text-[#E85D04]" />
            Team Directory
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Meet the brokers at Nationwide Transport Services
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brokers..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#E85D04]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400">No brokers found.</div>
      ) : (
        <div className="space-y-10">
          {officeKeys.map((office) => (
            <div key={office}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-base font-bold text-gray-900">{office}</h2>
                <span className="text-sm text-gray-400">
                  {grouped[office].length} {grouped[office].length === 1 ? "broker" : "brokers"}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
                {grouped[office].map((broker) => {
                  const fullName =
                    [broker.first_name, broker.last_name].filter(Boolean).join(" ") ||
                    "Broker";

                  return (
                    <Link
                      key={broker.id}
                      href={`/dashboard/brokers/${broker.id}`}
                      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-[#E85D04]/30"
                    >
                      {/* Photo */}
                      <div className="relative aspect-3/4 w-full overflow-hidden bg-gray-100">
                        {broker.avatar_url ? (
                          <Image
                            src={broker.avatar_url}
                            alt={fullName}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover object-top transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#1A1A1A] to-[#E85D04] text-4xl font-bold text-white">
                            {initials(broker.first_name, broker.last_name)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold leading-tight text-gray-900">
                          {fullName}
                        </p>
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-400">
                          {broker.headline ?? "Logistics Agent"}
                        </p>

                        {broker.specialties && broker.specialties.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {broker.specialties.slice(0, 2).map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#E85D04]">
                          View Profile
                          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
