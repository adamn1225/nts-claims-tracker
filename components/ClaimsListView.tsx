"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CalendarClock,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Truck,
  User,
} from "lucide-react";
import type {
  ClaimValueBucket,
  ClaimWithDetails,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Display helpers (kept in sync with ClaimsKanbanBoard.tsx so cards and rows
// read the same way)
// ---------------------------------------------------------------------------

const VALUE_BUCKET_LABEL: Record<ClaimValueBucket, string> = {
  current: "Current",
  credit_high_value: "Credit / High Value",
  legal: "Legal",
};

const VALUE_BUCKET_CLASSES: Record<ClaimValueBucket, string> = {
  current: "bg-slate-100 text-slate-700 border-slate-200",
  credit_high_value: "bg-amber-100 text-amber-800 border-amber-200",
  legal: "bg-violet-100 text-violet-800 border-violet-200",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  info: "bg-sky-100 text-sky-800 border-sky-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  accent: "bg-blue-100 text-blue-800 border-blue-200",
  primary: "bg-orange-100 text-orange-800 border-orange-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  critical: "bg-violet-100 text-violet-800 border-violet-200",
};

const statusBadgeClasses = (color: string | null | undefined) =>
  STATUS_BADGE_CLASSES[color ?? ""] ??
  "bg-slate-100 text-slate-700 border-slate-200";

const formatMoney = (
  amount: number | null | undefined,
  currency: string | null | undefined,
) => {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
};

const daysSince = (iso: string | null | undefined) => {
  if (!iso) return null;
  const opened = new Date(iso).getTime();
  if (Number.isNaN(opened)) return null;
  return Math.max(0, Math.floor((Date.now() - opened) / 86_400_000));
};

const ownerName = (owner: ClaimWithDetails["owner"]): string | null => {
  if (!owner) return null;
  const name = `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim();
  return name || owner.email || null;
};

const partyName = (
  claim: ClaimWithDetails,
  role: "shipper" | "customer" | "carrier",
): string | null => {
  const party = claim.parties.find((p) => p.role === role);
  if (!party) return null;
  return (
    party.company?.dba_name ||
    party.company?.legal_name ||
    party.contact_name ||
    null
  );
};

const carrierHasHold = (claim: ClaimWithDetails) =>
  claim.parties.some(
    (p) => p.role === "carrier" && p.company?.has_active_hold,
  );

// ---------------------------------------------------------------------------
// Sort plumbing
// ---------------------------------------------------------------------------

type SortField =
  | "claim_number"
  | "shipper"
  | "carrier"
  | "status"
  | "bucket"
  | "exposure"
  | "owner"
  | "age";
type SortDirection = "asc" | "desc";

const BUCKET_RANK: Record<ClaimValueBucket, number> = {
  current: 0,
  credit_high_value: 1,
  legal: 2,
};

const compareNullable = (
  a: string | number | null | undefined,
  b: string | number | null | undefined,
) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
};

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface ClaimsListViewProps {
  claims: ClaimWithDetails[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onAddClaim?: () => void;
}

export default function ClaimsListView({
  claims,
  isLoading = false,
  error = null,
  onRefresh,
  onAddClaim,
}: ClaimsListViewProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("age");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? claims.filter((c) => {
          const haystack = [
            c.claim_number,
            c.bol_number,
            partyName(c, "shipper"),
            partyName(c, "customer"),
            partyName(c, "carrier"),
            c.status?.name,
            ownerName(c.owner),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : claims.slice();

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortField) {
        case "claim_number":
          return dir * compareNullable(a.claim_number, b.claim_number);
        case "shipper":
          return (
            dir *
            compareNullable(
              partyName(a, "shipper") ?? partyName(a, "customer"),
              partyName(b, "shipper") ?? partyName(b, "customer"),
            )
          );
        case "carrier":
          return (
            dir * compareNullable(partyName(a, "carrier"), partyName(b, "carrier"))
          );
        case "status":
          return (
            dir *
            compareNullable(
              a.status?.position ?? null,
              b.status?.position ?? null,
            )
          );
        case "bucket":
          return dir * (BUCKET_RANK[a.value_bucket] - BUCKET_RANK[b.value_bucket]);
        case "exposure":
          return dir * compareNullable(a.damage_claim_amount, b.damage_claim_amount);
        case "owner":
          return dir * compareNullable(ownerName(a.owner), ownerName(b.owner));
        case "age":
          return dir * compareNullable(daysSince(a.opened_at), daysSince(b.opened_at));
        default:
          return 0;
      }
    });
    return filtered;
  }, [claims, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Most fields are most useful descending by default (newest/biggest first);
      // text columns feel more natural ascending.
      setSortDir(
        field === "claim_number" || field === "shipper" || field === "carrier" || field === "owner"
          ? "asc"
          : "desc",
      );
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-slate-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-600" />
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header ---------------------------------------------------------- */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Claims List</h1>
          <p className="text-xs text-slate-500">
            {isLoading
              ? "Loading claims…"
              : `${filteredAndSorted.length} of ${claims.length} ${
                  claims.length === 1 ? "claim" : "claims"
                }`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claim #, BOL, party, owner…"
              className="h-9 w-72 max-w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          )}
          {onAddClaim && (
            <button
              type="button"
              onClick={onAddClaim}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Claim
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Body ------------------------------------------------------------ */}
      {isLoading && claims.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white py-16">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">No claims found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search
                ? "Try a different search term."
                : "Claims promoted from the intake queue will appear here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <Th onClick={() => toggleSort("claim_number")}>
                    <span>Claim #</span>
                    <SortIcon field="claim_number" />
                  </Th>
                  <Th onClick={() => toggleSort("shipper")}>
                    <span>Shipper / Customer</span>
                    <SortIcon field="shipper" />
                  </Th>
                  <Th onClick={() => toggleSort("carrier")}>
                    <span>Carrier</span>
                    <SortIcon field="carrier" />
                  </Th>
                  <Th onClick={() => toggleSort("status")}>
                    <span>Status</span>
                    <SortIcon field="status" />
                  </Th>
                  <Th onClick={() => toggleSort("bucket")}>
                    <span>Bucket</span>
                    <SortIcon field="bucket" />
                  </Th>
                  <Th onClick={() => toggleSort("exposure")} align="right">
                    <span>Exposure</span>
                    <SortIcon field="exposure" />
                  </Th>
                  <Th onClick={() => toggleSort("owner")}>
                    <span>Owner</span>
                    <SortIcon field="owner" />
                  </Th>
                  <Th onClick={() => toggleSort("age")} align="right">
                    <span>Age</span>
                    <SortIcon field="age" />
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSorted.map((claim) => (
                  <ClaimRow key={claim.id} claim={claim} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row + header cell
// ---------------------------------------------------------------------------

function Th({
  children,
  onClick,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-slate-700 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {children}
      </button>
    </th>
  );
}

function ClaimRow({ claim }: { claim: ClaimWithDetails }) {
  const shipper = partyName(claim, "shipper") ?? partyName(claim, "customer");
  const carrier = partyName(claim, "carrier");
  const hold = carrierHasHold(claim);
  const owner = ownerName(claim.owner);
  const age = daysSince(claim.opened_at);
  const exposure = formatMoney(claim.damage_claim_amount, claim.currency);

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 align-top">
        <Link
          href={`/dashboard/claims/${claim.id}`}
          className="block font-mono text-sm font-semibold text-slate-900 hover:text-primary"
        >
          {claim.claim_number}
        </Link>
        {claim.bol_number && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <FileText className="h-3 w-3" />
            BOL {claim.bol_number}
          </div>
        )}
      </td>

      <td className="px-3 py-2 align-top">
        {shipper ? (
          <div className="flex items-start gap-1.5 text-slate-700">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="line-clamp-2">{shipper}</span>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      <td className="px-3 py-2 align-top">
        {carrier ? (
          <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
            <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="break-words">{carrier}</span>
            {hold && (
              <span
                title="Carrier has an active hold"
                className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700"
              >
                <AlertTriangle className="h-3 w-3" />
                HOLD
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      <td className="px-3 py-2 align-top">
        {claim.status ? (
          <span
            className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(claim.status.color)}`}
          >
            {claim.status.name}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      <td className="px-3 py-2 align-top">
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${VALUE_BUCKET_CLASSES[claim.value_bucket]}`}
        >
          {VALUE_BUCKET_LABEL[claim.value_bucket]}
        </span>
      </td>

      <td className="px-3 py-2 text-right align-top">
        {exposure ? (
          <span className="inline-flex items-center gap-1 font-medium text-slate-800">
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
            {exposure}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      <td className="px-3 py-2 align-top">
        {owner ? (
          <span className="inline-flex items-center gap-1 text-slate-700">
            <User className="h-3.5 w-3.5 text-slate-400" />
            {owner}
          </span>
        ) : (
          <span className="italic text-slate-400">Unassigned</span>
        )}
      </td>

      <td className="px-3 py-2 text-right align-top">
        {age != null ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
            {age}d
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}
