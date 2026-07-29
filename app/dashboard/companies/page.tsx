"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Building2, Loader2, Search, ShieldOff, Truck } from "lucide-react";

type CompanyRow = {
  id: string;
  legal_name: string;
  dba_name: string | null;
  kinds: string[];
  city: string | null;
  state: string | null;
  mc_number: string | null;
  dot_number: string | null;
  has_active_hold: boolean;
  is_active: boolean;
};

type ClaimCount = { company_id: string; count: number; exposure: number };

const KIND_LABELS: Record<string, string> = {
  shipper: "Shipper",
  carrier: "Carrier",
  factoring: "Factoring",
  accounts_payable: "AP",
  insurer: "Insurer",
  broker_agency: "Broker agency",
  other: "Other",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Company directory. Filters by kind + search string, computes claim counts
 * and exposure per company via a client-side aggregation of `claim_parties`
 * (small tables in the near term; swap for a materialised view if it slows).
 */
export default function CompaniesDirectoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [counts, setCounts] = useState<Map<string, ClaimCount>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [holdsOnly, setHoldsOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [companyRes, partyRes] = await Promise.all([
      supabase
        .from("companies")
        .select(
          `id, legal_name, dba_name, kinds, city, state,
           mc_number, dot_number, has_active_hold, is_active`,
        )
        .order("legal_name"),
      supabase
        .from("claim_parties")
        .select(
          `company_id,
           claim:claims(damage_claim_amount)`,
        ),
    ]);

    if (companyRes.error) {
      setError(companyRes.error.message);
      setLoading(false);
      return;
    }

    setCompanies((companyRes.data ?? []) as CompanyRow[]);

    const map = new Map<string, ClaimCount>();
    (partyRes.data ?? []).forEach((p) => {
      const amount = Number(
        (p.claim as unknown as { damage_claim_amount: number | null } | null)
          ?.damage_claim_amount ?? 0,
      );
      const entry = map.get(p.company_id) ?? {
        company_id: p.company_id,
        count: 0,
        exposure: 0,
      };
      entry.count += 1;
      entry.exposure += amount;
      map.set(p.company_id, entry);
    });
    setCounts(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let out = companies;
    if (!showInactive) out = out.filter((c) => c.is_active);
    if (holdsOnly) out = out.filter((c) => c.has_active_hold);
    if (kindFilter !== "all")
      out = out.filter((c) => c.kinds?.includes(kindFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.legal_name.toLowerCase().includes(q) ||
          c.dba_name?.toLowerCase().includes(q) ||
          c.mc_number?.toLowerCase().includes(q) ||
          c.dot_number?.toLowerCase().includes(q),
      );
    }
    return out;
  }, [companies, showInactive, holdsOnly, kindFilter, search]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Building2 className="h-6 w-6 text-slate-400" />
            Companies
          </h1>
          <p className="text-sm text-slate-500">
            Directory of every shipper, carrier, factoring company, AP, and
            insurer ever linked to a claim.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-600">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, DBA, MC #, DOT #…"
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-sm"
            />
          </div>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-600">Kind</span>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All kinds</option>
            {Object.entries(KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-1 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={holdsOnly}
              onChange={(e) => setHoldsOnly(e.target.checked)}
            />
            Do-not-pay only
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {filtered.length} {filtered.length === 1 ? "company" : "companies"}
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No companies match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Kinds</th>
                  <th className="px-3 py-2 font-semibold">IDs</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-3 py-2 font-semibold">Claims</th>
                  <th className="px-3 py-2 font-semibold">Exposure</th>
                  <th className="px-3 py-2 font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const stats = counts.get(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/companies/${c.id}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {c.dba_name || c.legal_name}
                        </Link>
                        {c.dba_name && c.dba_name !== c.legal_name && (
                          <p className="text-xs text-slate-500">
                            {c.legal_name}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(c.kinds ?? []).map((k) => (
                            <span
                              key={k}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                            >
                              {KIND_LABELS[k] ?? k}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {c.mc_number ? `MC ${c.mc_number}` : ""}
                        {c.mc_number && c.dot_number && " · "}
                        {c.dot_number ? `DOT ${c.dot_number}` : ""}
                        {!c.mc_number && !c.dot_number && "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {stats?.count ?? 0}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {stats ? fmtMoney(stats.exposure) : "$0"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {c.has_active_hold && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-danger/10 px-1.5 py-0.5 font-semibold text-danger">
                              <ShieldOff className="h-3 w-3" />
                              HOLD
                            </span>
                          )}
                          {!c.is_active && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                              INACTIVE
                            </span>
                          )}
                          {c.kinds?.includes("carrier") &&
                            !c.has_active_hold &&
                            c.is_active && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 font-semibold text-success">
                                <Truck className="h-3 w-3" />
                                OK
                              </span>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
