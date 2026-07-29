"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart3,
  Building2,
  DollarSign,
  Download,
  FileWarning,
  Loader2,
  Package,
  ShieldAlert,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import { claimTypeLabel } from "@/lib/constants/claim-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClaimRow = {
  id: string;
  claim_number: string;
  opened_at: string;
  closed_at: string | null;
  status_id: string;
  damage_claim_amount: number | null;
  shipment_value: number | null;
  value_bucket: "current" | "credit_high_value" | "legal";
  currency: string;
  owner_id: string | null;
  freight_type_id: string | null;
  trailer_type_id: string | null;
  filing_status: string | null;
  claim_type: string | null;
};

type StatusRow = {
  id: string;
  name: string;
  is_closed: boolean;
  is_denied: boolean;
};

type OwnerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  office_location: string | null;
};

type LookupRow = { id: string; name: string };

type TransactionRow = {
  claim_id: string;
  transaction_type: string;
  payment_source: string;
  amount: number;
  transaction_date: string;
};

type PartyRow = {
  claim_id: string;
  role: string;
  company: {
    id: string;
    legal_name: string | null;
    dba_name: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtMoney = (n: number, ccy = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
  }).format(n);

const daysBetween = (a: string, b?: string | null) => {
  const t1 = new Date(a).getTime();
  const t2 = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.floor((t2 - t1) / (1000 * 60 * 60 * 24)));
};

function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]) {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Claims Reports Hub
 *
 * Replaces the sales-tracker-era role router. Aggregates the metrics the
 * claims team explicitly asked for in the discovery meeting:
 *  - Claims by office, owner, carrier, freight type
 *  - Payment source breakdown (Concession / Paid / Direct / Recovery / Outbound)
 *  - Portfolio KPIs (open / closed / denied / avg age / total exposure)
 *
 * Managers/admins get the whole company; claims_staff see what RLS gives
 * them (own + queue). Brokers are gated out entirely.
 */
export default function ClaimsReportsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [rangeDays, setRangeDays] = useState<30 | 90 | 365 | 0>(365);
  const [officeFilter, setOfficeFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [valueBucketFilter, setValueBucketFilter] = useState<string>("");

  // Data
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [freightTypes, setFreightTypes] = useState<LookupRow[]>([]);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [parties, setParties] = useState<PartyRow[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) {
        setError("Profile not found");
        setLoading(false);
        return;
      }
      setRole(profile.role);
      setLoading(false);
    })();
  }, [supabase, router]);

  const load = useCallback(async () => {
    if (!role) return;
    setError(null);

    const sinceIso =
      rangeDays === 0
        ? null
        : new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

    let claimsQuery = supabase
      .from("claims")
      .select(
        `id, claim_number, opened_at, closed_at, status_id,
         damage_claim_amount, shipment_value, value_bucket, currency,
         owner_id, freight_type_id, trailer_type_id, filing_status,
         claim_type`,
      );
    if (sinceIso) claimsQuery = claimsQuery.gte("opened_at", sinceIso);
    if (valueBucketFilter)
      claimsQuery = claimsQuery.eq(
        "value_bucket",
        valueBucketFilter as ClaimRow["value_bucket"],
      );
    if (ownerFilter) claimsQuery = claimsQuery.eq("owner_id", ownerFilter);

    const [claimsRes, statusRes, ownersRes, ftRes, txnRes, partyRes] =
      await Promise.all([
        claimsQuery,
        supabase.from("claim_statuses").select("id, name, is_closed, is_denied"),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, office_location")
          .eq("is_active", true),
        supabase.from("freight_types").select("id, name"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new table
        (supabase as any)
          .from("claim_transactions")
          .select(
            "claim_id, transaction_type, payment_source, amount, transaction_date",
          ),
        supabase
          .from("claim_parties")
          .select(
            "claim_id, role, company:companies(id, legal_name, dba_name)",
          ),
      ]);

    if (claimsRes.error) setError(claimsRes.error.message);

    const rawClaims = (claimsRes.data ?? []) as ClaimRow[];
    let scoped = rawClaims;
    if (officeFilter && ownersRes.data) {
      const officeOwnerIds = new Set(
        ownersRes.data
          .filter((o) => o.office_location === officeFilter)
          .map((o) => o.id),
      );
      scoped = scoped.filter(
        (c) => c.owner_id && officeOwnerIds.has(c.owner_id),
      );
    }

    setClaims(scoped);
    setStatuses((statusRes.data ?? []) as StatusRow[]);
    setOwners((ownersRes.data ?? []) as OwnerRow[]);
    setFreightTypes((ftRes.data ?? []) as LookupRow[]);
    setTxns((txnRes.data ?? []) as TransactionRow[]);
    setParties(
      (partyRes.data ?? []).map((p) => ({
        claim_id: p.claim_id,
        role: p.role,
        company: (p.company as unknown as PartyRow["company"]) ?? null,
      })),
    );
  }, [role, rangeDays, valueBucketFilter, officeFilter, ownerFilter, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const claimStatusMap = useMemo(() => {
    const m = new Map<string, StatusRow>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

  const kpis = useMemo(() => {
    let openCount = 0;
    let closedCount = 0;
    let deniedCount = 0;
    let totalExposure = 0;
    let ageSumClosed = 0;
    let ageSumOpen = 0;

    for (const c of claims) {
      const status = c.status_id ? claimStatusMap.get(c.status_id) : null;
      const isClosed = Boolean(status?.is_closed || c.closed_at);
      const isDenied = Boolean(status?.is_denied);
      const exposure = Number(c.damage_claim_amount ?? 0);
      totalExposure += exposure;
      if (isDenied) deniedCount += 1;
      if (isClosed) {
        closedCount += 1;
        ageSumClosed += daysBetween(c.opened_at, c.closed_at);
      } else {
        openCount += 1;
        ageSumOpen += daysBetween(c.opened_at);
      }
    }

    return {
      total: claims.length,
      open: openCount,
      closed: closedCount,
      denied: deniedCount,
      totalExposure,
      avgAgeClosed:
        closedCount > 0 ? Math.round(ageSumClosed / closedCount) : 0,
      avgAgeOpen: openCount > 0 ? Math.round(ageSumOpen / openCount) : 0,
    };
  }, [claims, claimStatusMap]);

  const paymentBreakdown = useMemo(() => {
    const byType: Record<string, number> = {
      inbound_payment: 0,
      concession: 0,
      direct_payment: 0,
      recovery: 0,
      outbound_payment: 0,
    };
    const bySource: Record<string, number> = {};
    for (const t of txns) {
      if (byType[t.transaction_type] !== undefined) {
        byType[t.transaction_type] += Number(t.amount);
      }
      bySource[t.payment_source] =
        (bySource[t.payment_source] ?? 0) + Number(t.amount);
    }
    return { byType, bySource };
  }, [txns]);

  const byOffice = useMemo(() => {
    const rows = new Map<
      string,
      { office: string; count: number; total: number }
    >();
    for (const c of claims) {
      const owner = c.owner_id ? owners.find((o) => o.id === c.owner_id) : null;
      const office = owner?.office_location || "— Unassigned";
      const bucket = rows.get(office) ?? { office, count: 0, total: 0 };
      bucket.count += 1;
      bucket.total += Number(c.damage_claim_amount ?? 0);
      rows.set(office, bucket);
    }
    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }, [claims, owners]);

  const byOwner = useMemo(() => {
    const rows = new Map<
      string,
      { name: string; office: string | null; count: number; total: number }
    >();
    for (const c of claims) {
      const owner = c.owner_id ? owners.find((o) => o.id === c.owner_id) : null;
      const name = owner
        ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() ||
          "Unnamed"
        : "— Unassigned";
      const key = c.owner_id ?? "unassigned";
      const bucket =
        rows.get(key) ?? {
          name,
          office: owner?.office_location ?? null,
          count: 0,
          total: 0,
        };
      bucket.count += 1;
      bucket.total += Number(c.damage_claim_amount ?? 0);
      rows.set(key, bucket);
    }
    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }, [claims, owners]);

  const byFreightType = useMemo(() => {
    type Row = {
      name: string;
      count: number;
      total: number;
      closed: number;
      open: number;
      closedAmount: number;
    };
    const rows = new Map<string, Row>();
    for (const c of claims) {
      const ft = c.freight_type_id
        ? freightTypes.find((f) => f.id === c.freight_type_id)
        : null;
      const name = ft?.name || "— No type";
      const bucket =
        rows.get(name) ?? {
          name,
          count: 0,
          total: 0,
          closed: 0,
          open: 0,
          closedAmount: 0,
        };
      bucket.count += 1;
      bucket.total += Number(c.damage_claim_amount ?? 0);
      const status = c.status_id ? claimStatusMap.get(c.status_id) : null;
      if (status?.is_closed || c.closed_at) {
        bucket.closed += 1;
        bucket.closedAmount += Number(c.damage_claim_amount ?? 0);
      } else {
        bucket.open += 1;
      }
      rows.set(name, bucket);
    }
    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }, [claims, freightTypes, claimStatusMap]);

  const byClaimType = useMemo(() => {
    const rows = new Map<
      string,
      { name: string; count: number; total: number }
    >();
    for (const c of claims) {
      const t = c.claim_type || "";
      const bucket = rows.get(t) ?? { name: t, count: 0, total: 0 };
      bucket.count += 1;
      bucket.total += Number(c.damage_claim_amount ?? 0);
      rows.set(t, bucket);
    }
    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }, [claims]);

  const byCarrier = useMemo(() => {
    const rows = new Map<
      string,
      { name: string; count: number; total: number }
    >();
    const carrierClaimAmounts = new Map<string, number>();
    for (const c of claims) {
      carrierClaimAmounts.set(c.id, Number(c.damage_claim_amount ?? 0));
    }
    for (const p of parties) {
      if (p.role !== "carrier" || !p.company) continue;
      const name =
        p.company.dba_name || p.company.legal_name || "Unnamed carrier";
      const bucket = rows.get(p.company.id) ?? { name, count: 0, total: 0 };
      bucket.count += 1;
      bucket.total += carrierClaimAmounts.get(p.claim_id) ?? 0;
      rows.set(p.company.id, bucket);
    }
    return Array.from(rows.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [parties, claims]);

  const uniqueOffices = useMemo(() => {
    const s = new Set<string>();
    owners.forEach((o) => {
      if (o.office_location) s.add(o.office_location);
    });
    return Array.from(s).sort();
  }, [owners]);

  const handleExport = () => {
    const rows = claims.map((c) => {
      const owner = c.owner_id ? owners.find((o) => o.id === c.owner_id) : null;
      const status = c.status_id ? claimStatusMap.get(c.status_id) : null;
      const ft = c.freight_type_id
        ? freightTypes.find((f) => f.id === c.freight_type_id)
        : null;
      return {
        claim_number: c.claim_number,
        opened_at: c.opened_at,
        closed_at: c.closed_at ?? "",
        status: status?.name ?? "",
        value_bucket: c.value_bucket,
        damage_claim_amount: c.damage_claim_amount ?? "",
        currency: c.currency,
        owner: owner
          ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
          : "",
        office: owner?.office_location ?? "",
        freight_type: ft?.name ?? "",
        filing_status: c.filing_status ?? "",
      };
    });
    downloadCsv(
      `claims-report-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (role === "broker") {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-warning/30 bg-warning/5 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">
          Access restricted
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Reports are limited to claims staff, managers, and admins. Contact
          your manager if you need access.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Claims reports
          </h1>
          <p className="text-sm text-slate-500">
            Portfolio metrics, breakdowns by office / owner / carrier / freight
            type, and payment source rollups.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-600">Time range</span>
          <select
            value={rangeDays}
            onChange={(e) =>
              setRangeDays(Number(e.target.value) as 30 | 90 | 365 | 0)
            }
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
            <option value={0}>All time</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-600">Office</span>
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All offices</option>
            {uniqueOffices.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-600">Owner</span>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {`${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() ||
                  "Unnamed"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Value bucket
          </span>
          <select
            value={valueBucketFilter}
            onChange={(e) => setValueBucketFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All buckets</option>
            <option value="current">Current (&lt;$10K)</option>
            <option value="credit_high_value">Credit / High Value</option>
            <option value="legal">Legal</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi label="Total claims" value={String(kpis.total)} icon={BarChart3} />
        <Kpi label="Open" value={String(kpis.open)} icon={Package} />
        <Kpi label="Closed" value={String(kpis.closed)} icon={Package} />
        <Kpi label="Denied" value={String(kpis.denied)} icon={FileWarning} />
        <Kpi
          label="Total exposure"
          value={fmtMoney(kpis.totalExposure)}
          icon={DollarSign}
        />
        <Kpi label="Avg age (open)" value={`${kpis.avgAgeOpen}d`} icon={BarChart3} />
        <Kpi
          label="Avg age (closed)"
          value={`${kpis.avgAgeClosed}d`}
          icon={BarChart3}
        />
      </div>

      <Section
        icon={DollarSign}
        title="Payment source breakdown"
        subtitle="Cash flow from transactions logged against claims in this window."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <RollupTile
            label="Paid"
            value={paymentBreakdown.byType.inbound_payment ?? 0}
            tone="success"
          />
          <RollupTile
            label="Concession"
            value={paymentBreakdown.byType.concession ?? 0}
            tone="accent"
          />
          <RollupTile
            label="Direct pay"
            value={paymentBreakdown.byType.direct_payment ?? 0}
            tone="info"
          />
          <RollupTile
            label="Recovery"
            value={paymentBreakdown.byType.recovery ?? 0}
            tone="critical"
          />
          <RollupTile
            label="Outbound"
            value={paymentBreakdown.byType.outbound_payment ?? 0}
            tone="warning"
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-2 font-medium">Source</th>
                <th className="py-1 pr-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(paymentBreakdown.bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, total]) => (
                  <tr key={source} className="border-t border-slate-100">
                    <td className="py-1 pr-2 capitalize">{source}</td>
                    <td className="py-1 pr-2 font-medium">
                      {fmtMoney(total)}
                    </td>
                  </tr>
                ))}
              {Object.keys(paymentBreakdown.bySource).length === 0 && (
                <tr>
                  <td colSpan={2} className="py-2 text-slate-500">
                    No transactions logged in this window yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={Building2} title="By office">
          <BreakdownTable rows={byOffice} keyLabel="Office" primaryKey="office" />
        </Section>
        <Section icon={Users} title="By owner">
          <BreakdownTable
            rows={byOwner.map((r) => ({ ...r, office: r.office ?? "" }))}
            keyLabel="Owner"
            primaryKey="name"
            secondaryLabel="Office"
            secondaryKey="office"
          />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={Truck} title="Top carriers (by exposure)">
          <BreakdownTable rows={byCarrier} keyLabel="Carrier" primaryKey="name" />
        </Section>
        <Section
          icon={Tag}
          title="By claim type"
          subtitle="Cause-of-loss breakdown — helps surface cargo-specific patterns."
        >
          <BreakdownTable
            rows={byClaimType.map((r) => ({ ...r, name: claimTypeLabel(r.name) }))}
            keyLabel="Claim type"
            primaryKey="name"
          />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Section
          icon={Package}
          title="By freight type"
          subtitle="Deep-dive with open vs closed split, closure rate, and avg claim amount per cargo type."
        >
          <FreightTypeTable rows={byFreightType} />
        </Section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function BreakdownTable({
  rows,
  keyLabel,
  primaryKey,
  secondaryLabel,
  secondaryKey,
}: {
  rows: Array<{ [k: string]: unknown; count: number; total: number }>;
  keyLabel: string;
  primaryKey: string;
  secondaryLabel?: string;
  secondaryKey?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-2 font-medium">{keyLabel}</th>
            {secondaryLabel && (
              <th className="py-1 pr-2 font-medium">{secondaryLabel}</th>
            )}
            <th className="py-1 pr-2 font-medium">Claims</th>
            <th className="py-1 pr-2 font-medium">Exposure</th>
            <th className="w-40 py-1 pr-2 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = max > 0 ? (r.total / max) * 100 : 0;
            return (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1 pr-2 text-slate-800">
                  {String(r[primaryKey] ?? "—")}
                </td>
                {secondaryLabel && secondaryKey && (
                  <td className="py-1 pr-2 text-slate-500">
                    {String(r[secondaryKey] ?? "—")}
                  </td>
                )}
                <td className="py-1 pr-2">{r.count}</td>
                <td className="py-1 pr-2 font-medium">{fmtMoney(r.total)}</td>
                <td className="py-1 pr-2">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FreightTypeTable({
  rows,
}: {
  rows: Array<{
    name: string;
    count: number;
    total: number;
    open: number;
    closed: number;
    closedAmount: number;
  }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-3 font-medium">Freight type</th>
            <th className="py-1 pr-3 text-right font-medium">Claims</th>
            <th className="py-1 pr-3 text-right font-medium">Open</th>
            <th className="py-1 pr-3 text-right font-medium">Closed</th>
            <th className="py-1 pr-3 text-right font-medium">Closure rate</th>
            <th className="py-1 pr-3 text-right font-medium">Avg claim</th>
            <th className="py-1 text-right font-medium">Exposure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const closureRate =
              row.count > 0 ? Math.round((row.closed / row.count) * 100) : 0;
            const average = row.count > 0 ? row.total / row.count : 0;
            return (
              <tr key={row.name} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 font-medium text-slate-800">
                  {row.name}
                </td>
                <td className="py-1.5 pr-3 text-right">{row.count}</td>
                <td className="py-1.5 pr-3 text-right">{row.open}</td>
                <td className="py-1.5 pr-3 text-right">{row.closed}</td>
                <td className="py-1.5 pr-3 text-right">{closureRate}%</td>
                <td className="py-1.5 pr-3 text-right">{fmtMoney(average)}</td>
                <td className="py-1.5 text-right font-medium">
                  {fmtMoney(row.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RollupTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "accent" | "info" | "critical" | "warning";
}) {
  const toneClass: Record<typeof tone, string> = {
    success: "border-success/20 bg-success/5 text-success",
    accent: "border-accent/20 bg-accent/5 text-accent",
    info: "border-info/20 bg-info/5 text-info-text",
    critical: "border-critical/20 bg-critical/5 text-critical",
    warning: "border-warning/30 bg-warning/5 text-warning-text",
  };
  return (
    <div className={`rounded-md border px-2 py-2 ${toneClass[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold">{fmtMoney(value)}</p>
    </div>
  );
}
