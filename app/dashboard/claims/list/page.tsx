"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Filter,
  Inbox,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClaimRow = {
  id: string;
  claim_number: string;
  opened_at: string;
  last_activity_at: string;
  closed_at: string | null;
  damage_claim_amount: number | null;
  currency: string;
  status_id: string;
  owner_id: string | null;
  value_bucket: string;
  filing_status: string | null;
  status: { id: string; name: string; is_closed: boolean } | null;
  parties: Array<{
    role: string;
    company: {
      id: string;
      legal_name: string | null;
      dba_name: string | null;
      has_active_hold: boolean | null;
    } | null;
  }>;
  owner: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

type Bucket = "not_filed" | "filed" | "closed" | "all";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtMoney = (n: number | null, ccy = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: ccy,
        maximumFractionDigits: 2,
      }).format(n);

const daysBetween = (a: string, b?: string | null) => {
  const t1 = new Date(a).getTime();
  const t2 = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.floor((t2 - t1) / (1000 * 60 * 60 * 24)));
};

const relTime = (iso: string) => {
  const d = daysBetween(iso);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
};

function partyName(claim: ClaimRow, role: string): string | null {
  const p = claim.parties.find((x) => x.role === role);
  if (!p || !p.company) return null;
  return p.company.dba_name || p.company.legal_name || null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Claims List View — FreightClaims-parity table layout.
 *
 * Mirrors the sidebar / stat-strip / chip-filter / table pattern from the
 * FreightClaims screens the team showed but backed by our own data. The
 * chip filters ("Has tasks", "Overdue", "Do not pay carrier") were added
 * based on P3 (management self-service) and quick-triage needs.
 */
export default function ClaimsListPage() {
  const supabase = useMemo(() => createClient(), []);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // View state
  const [bucket, setBucket] = useState<Bucket>("all");
  const [scope, setScope] = useState<"mine" | "team">("team");
  const [chips, setChips] = useState<{
    hasOpenTasks: boolean;
    overdueTasks: boolean;
    doNotPayCarrier: boolean;
    highValue: boolean;
  }>({
    hasOpenTasks: false,
    overdueTasks: false,
    doNotPayCarrier: false,
    highValue: false,
  });
  const [search, setSearch] = useState("");

  // Selection (bulk actions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignableUsers, setAssignableUsers] = useState<
    Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>
  >([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Saved views
  type SavedView = {
    id: string;
    name: string;
    filters: {
      bucket: Bucket;
      scope: "mine" | "team";
      chips: typeof chips;
      search: string;
    };
    is_default: boolean;
  };
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  // Per-claim task counts (for chip filters)
  const [openTaskCounts, setOpenTaskCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [overdueTaskCounts, setOverdueTaskCounts] = useState<
    Map<string, number>
  >(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const [claimsRes, tasksRes] = await Promise.all([
      supabase
        .from("claims")
        .select(
          `id, claim_number, opened_at, last_activity_at, closed_at,
           damage_claim_amount, currency, status_id, owner_id, value_bucket,
           filing_status,
           status:claim_statuses!claims_status_id_fkey (id, name, is_closed),
           parties:claim_parties (
             role,
             company:companies (id, legal_name, dba_name, has_active_hold)
           ),
           owner:profiles!claims_owner_id_fkey (
             id, first_name, last_name, email
           )`,
        )
        .order("last_activity_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("claim_id, status, due_at")
        .in("status", ["open", "in_progress"]),
    ]);

    if (claimsRes.error) {
      setError(claimsRes.error.message);
      setClaims([]);
    } else {
      setClaims((claimsRes.data ?? []) as unknown as ClaimRow[]);
    }

    // Aggregate task counts client-side
    const openCounts = new Map<string, number>();
    const overdueCounts = new Map<string, number>();
    const now = Date.now();
    (tasksRes.data ?? []).forEach((t) => {
      openCounts.set(t.claim_id, (openCounts.get(t.claim_id) ?? 0) + 1);
      if (t.due_at && new Date(t.due_at).getTime() < now) {
        overdueCounts.set(
          t.claim_id,
          (overdueCounts.get(t.claim_id) ?? 0) + 1,
        );
      }
    });
    setOpenTaskCounts(openCounts);
    setOverdueTaskCounts(overdueCounts);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Load bulk-assignable users + saved views once.
  useEffect(() => {
    (async () => {
      const [usersRes, viewsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("is_active", true)
          .in("role", ["admin", "manager", "claims_staff"])
          .order("first_name"),
        fetch("/api/list-views?scope=claims_list").then((r) => r.json()),
      ]);
      setAssignableUsers(
        (usersRes.data ?? []) as typeof assignableUsers,
      );
      if (viewsRes?.views) setSavedViews(viewsRes.views);
    })();
    // Loading assignable users only depends on supabase; the setter refs
    // are stable and we don't want a re-fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const applyView = (v: SavedView) => {
    setBucket(v.filters.bucket);
    setScope(v.filters.scope);
    setChips(v.filters.chips);
    setSearch(v.filters.search);
  };

  const saveView = async () => {
    if (!newViewName.trim()) return;
    try {
      const res = await fetch("/api/list-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newViewName.trim(),
          scope: "claims_list",
          filters: { bucket, scope, chips, search },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSavedViews((prev) => {
        const withoutDupe = prev.filter((v) => v.name !== newViewName.trim());
        return [...withoutDupe, json.view].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
      setNewViewName("");
      setShowSaveForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteView = async (id: string) => {
    if (!confirm("Delete this saved view?")) return;
    try {
      await fetch(`/api/list-views?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const bulkAssign = async (ownerId: string | null) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/claims/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_ids: Array.from(selectedIds),
          owner_id: ownerId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bulk assign failed");
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let out = claims;

    // Scope
    if (scope === "mine" && currentUserId) {
      out = out.filter((c) => c.owner_id === currentUserId);
    }

    // Bucket (FreightClaims-parity sidebar)
    switch (bucket) {
      case "not_filed":
        out = out.filter((c) => c.filing_status === "not_filed");
        break;
      case "filed":
        out = out.filter(
          (c) =>
            c.filing_status === "filed_not_acknowledged" ||
            c.filing_status === "acknowledged",
        );
        break;
      case "closed":
        out = out.filter((c) => c.closed_at || c.status?.is_closed);
        break;
      case "all":
      default:
        break;
    }

    // Chip filters
    if (chips.hasOpenTasks)
      out = out.filter((c) => (openTaskCounts.get(c.id) ?? 0) > 0);
    if (chips.overdueTasks)
      out = out.filter((c) => (overdueTaskCounts.get(c.id) ?? 0) > 0);
    if (chips.doNotPayCarrier)
      out = out.filter((c) =>
        c.parties.some(
          (p) => p.role === "carrier" && p.company?.has_active_hold,
        ),
      );
    if (chips.highValue)
      out = out.filter(
        (c) =>
          c.value_bucket === "credit_high_value" || c.value_bucket === "legal",
      );

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.claim_number.toLowerCase().includes(q) ||
          partyName(c, "shipper")?.toLowerCase().includes(q) ||
          partyName(c, "customer")?.toLowerCase().includes(q) ||
          partyName(c, "carrier")?.toLowerCase().includes(q),
      );
    }

    return out;
  }, [
    claims,
    scope,
    currentUserId,
    bucket,
    chips,
    openTaskCounts,
    overdueTaskCounts,
    search,
  ]);

  const bucketCounts = useMemo(() => {
    const scoped =
      scope === "mine" && currentUserId
        ? claims.filter((c) => c.owner_id === currentUserId)
        : claims;
    return {
      not_filed: scoped.filter((c) => c.filing_status === "not_filed").length,
      filed: scoped.filter(
        (c) =>
          c.filing_status === "filed_not_acknowledged" ||
          c.filing_status === "acknowledged",
      ).length,
      closed: scoped.filter((c) => c.closed_at || c.status?.is_closed).length,
      all: scoped.length,
    };
  }, [claims, scope, currentUserId]);

  const stats = useMemo(() => {
    const total = filtered.length;
    let ageSum = 0;
    let amountSum = 0;
    filtered.forEach((c) => {
      ageSum += daysBetween(c.opened_at, c.closed_at);
      amountSum += Number(c.damage_claim_amount ?? 0);
    });
    return {
      count: total,
      avgAge: total > 0 ? Math.round(ageSum / total) : 0,
      totalAmount: amountSum,
    };
  }, [filtered]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-4">
        <SidebarSection title="My claims">
          <SidebarLink
            active={scope === "mine" && bucket === "not_filed"}
            onClick={() => {
              setScope("mine");
              setBucket("not_filed");
            }}
            label="Not filed"
            count={
              scope === "mine"
                ? bucketCounts.not_filed
                : claims.filter(
                    (c) =>
                      c.owner_id === currentUserId &&
                      c.filing_status === "not_filed",
                  ).length
            }
          />
          <SidebarLink
            active={scope === "mine" && bucket === "filed"}
            onClick={() => {
              setScope("mine");
              setBucket("filed");
            }}
            label="Filed"
            count={
              scope === "mine"
                ? bucketCounts.filed
                : claims.filter(
                    (c) =>
                      c.owner_id === currentUserId &&
                      (c.filing_status === "filed_not_acknowledged" ||
                        c.filing_status === "acknowledged"),
                  ).length
            }
          />
          <SidebarLink
            active={scope === "mine" && bucket === "closed"}
            onClick={() => {
              setScope("mine");
              setBucket("closed");
            }}
            label="Closed"
            count={
              scope === "mine"
                ? bucketCounts.closed
                : claims.filter(
                    (c) =>
                      c.owner_id === currentUserId &&
                      (c.closed_at || c.status?.is_closed),
                  ).length
            }
          />
          <SidebarLink
            active={scope === "mine" && bucket === "all"}
            onClick={() => {
              setScope("mine");
              setBucket("all");
            }}
            label="All"
            count={
              claims.filter((c) => c.owner_id === currentUserId).length
            }
          />
        </SidebarSection>

        <SidebarSection title="Nationwide Transport">
          <SidebarLink
            active={scope === "team" && bucket === "not_filed"}
            onClick={() => {
              setScope("team");
              setBucket("not_filed");
            }}
            label="Not filed"
            count={
              claims.filter((c) => c.filing_status === "not_filed").length
            }
          />
          <SidebarLink
            active={scope === "team" && bucket === "filed"}
            onClick={() => {
              setScope("team");
              setBucket("filed");
            }}
            label="Filed"
            count={
              claims.filter(
                (c) =>
                  c.filing_status === "filed_not_acknowledged" ||
                  c.filing_status === "acknowledged",
              ).length
            }
          />
          <SidebarLink
            active={scope === "team" && bucket === "closed"}
            onClick={() => {
              setScope("team");
              setBucket("closed");
            }}
            label="Closed"
            count={
              claims.filter((c) => c.closed_at || c.status?.is_closed).length
            }
          />
          <SidebarLink
            active={scope === "team" && bucket === "all"}
            onClick={() => {
              setScope("team");
              setBucket("all");
            }}
            label="All claims"
            count={claims.length}
          />
        </SidebarSection>

        <div className="pt-2">
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
          >
            <Filter className="h-3.5 w-3.5" />
            Claim settings
          </Link>
        </div>
      </aside>

      {/* Main */}
      <section className="space-y-4">
        {/* Search + New */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claims, carriers, customers…"
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/dashboard/claims/intake"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-text"
          >
            + New claim
          </Link>
        </div>

        <h1 className="text-xl font-semibold text-slate-900">
          {scope === "mine" ? "My claims" : "Nationwide Transport"}
          <span className="ml-1 font-normal text-slate-500">
            —{" "}
            {bucket === "not_filed"
              ? "Not filed"
              : bucket === "filed"
                ? "Filed"
                : bucket === "closed"
                  ? "Closed"
                  : "All"}
          </span>
        </h1>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Claim count" value={String(stats.count)} icon={Package} />
          <StatCard label="Average claim age" value={`${stats.avgAge} days`} icon={Package} />
          <StatCard
            label="Total claim amount"
            value={fmtMoney(stats.totalAmount)}
            icon={Package}
            note="Only includes USD amounts."
          />
        </div>

        {/* Chip filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            active={chips.hasOpenTasks}
            onClick={() =>
              setChips((c) => ({ ...c, hasOpenTasks: !c.hasOpenTasks }))
            }
            label="Has open tasks"
          />
          <Chip
            active={chips.overdueTasks}
            onClick={() =>
              setChips((c) => ({ ...c, overdueTasks: !c.overdueTasks }))
            }
            label="Has overdue tasks"
          />
          <Chip
            active={chips.doNotPayCarrier}
            onClick={() =>
              setChips((c) => ({ ...c, doNotPayCarrier: !c.doNotPayCarrier }))
            }
            label="Do-not-pay carrier"
          />
          <Chip
            active={chips.highValue}
            onClick={() =>
              setChips((c) => ({ ...c, highValue: !c.highValue }))
            }
            label="High value / legal"
          />
          {(chips.hasOpenTasks ||
            chips.overdueTasks ||
            chips.doNotPayCarrier ||
            chips.highValue) && (
            <button
              type="button"
              onClick={() =>
                setChips({
                  hasOpenTasks: false,
                  overdueTasks: false,
                  doNotPayCarrier: false,
                  highValue: false,
                })
              }
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              Reset
            </button>
          )}
        </div>

        {/* Saved views */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Saved views:
          </span>
          {savedViews.length === 0 && (
            <span className="text-xs italic text-slate-400">None yet</span>
          )}
          {savedViews.map((v) => (
            <span
              key={v.id}
              className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => applyView(v)}
                className="font-medium text-slate-700 hover:text-primary-text"
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => deleteView(v.id)}
                className="text-slate-300 hover:text-danger"
                aria-label="Delete view"
              >
                ×
              </button>
            </span>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {showSaveForm ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="View name"
                  onKeyDown={(e) => e.key === "Enter" && saveView()}
                  className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs"
                />
                <button
                  type="button"
                  onClick={saveView}
                  className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-white hover:bg-primary-text"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveForm(false);
                    setNewViewName("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                className="text-xs text-accent hover:underline"
              >
                + Save current filters
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar (visible when rows are selected) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
            <span className="text-xs font-semibold text-primary-text">
              {selectedIds.size} selected
            </span>
            <span className="text-xs text-slate-500">·</span>
            <label className="text-xs text-slate-600">Assign to:</label>
            <select
              disabled={bulkBusy}
              onChange={(e) => {
                const v = e.target.value;
                bulkAssign(v === "__unassign__" ? null : v);
                e.target.value = "";
              }}
              defaultValue=""
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="" disabled>
                Choose owner…
              </option>
              <option value="__unassign__">— Unassigned (queue)</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
                    u.email}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700"
            >
              Clear selection
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {filtered.length} {filtered.length === 1 ? "claim" : "claims"}
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">No claims match these filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-8 px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={
                          filtered.length > 0 &&
                          filtered.every((c) => selectedIds.has(c.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(
                              new Set(filtered.map((c) => c.id)),
                            );
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 font-semibold">Claim #</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Carrier</th>
                    <th className="px-3 py-2 font-semibold">Owner</th>
                    <th className="px-3 py-2 font-semibold">Opened</th>
                    <th className="px-3 py-2 font-semibold">Last update</th>
                    <th className="px-3 py-2 font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Filing</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const carrier = partyName(c, "carrier");
                    const shipper =
                      partyName(c, "shipper") ?? partyName(c, "customer");
                    const carrierHold = c.parties.some(
                      (p) => p.role === "carrier" && p.company?.has_active_hold,
                    );
                    const openTasks = openTaskCounts.get(c.id) ?? 0;
                    const overdue = overdueTaskCounts.get(c.id) ?? 0;
                    const isSelected = selectedIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-2 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={`Select ${c.claim_number}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/dashboard/claims/${c.id}`}
                            className="font-mono text-sm font-semibold text-accent hover:underline"
                          >
                            {c.claim_number}
                          </Link>
                          {(openTasks > 0 || overdue > 0) && (
                            <div className="mt-0.5 flex gap-1">
                              {openTasks > 0 && (
                                <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
                                  {openTasks} tasks
                                </span>
                              )}
                              {overdue > 0 && (
                                <span className="rounded bg-danger/10 px-1 text-[10px] font-semibold text-danger">
                                  {overdue} overdue
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {shipper ?? (
                            <span className="italic text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Truck className="h-3.5 w-3.5 text-slate-400" />
                            {carrier ?? (
                              <span className="italic text-slate-400">—</span>
                            )}
                            {carrierHold && (
                              <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-danger/10 px-1 text-[10px] font-semibold text-danger">
                                <AlertTriangle className="h-3 w-3" /> HOLD
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {c.owner
                            ? `${c.owner.first_name ?? ""} ${
                                c.owner.last_name ?? ""
                              }`.trim() || c.owner.email
                            : (
                                <span className="italic text-slate-400">
                                  Unassigned
                                </span>
                              )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          <div className="whitespace-nowrap">
                            {new Date(c.opened_at).toLocaleDateString()}
                          </div>
                          <div>{relTime(c.opened_at)}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          <div className="whitespace-nowrap">
                            {new Date(
                              c.last_activity_at,
                            ).toLocaleDateString()}
                          </div>
                          <div>{relTime(c.last_activity_at)}</div>
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-900">
                          {fmtMoney(c.damage_claim_amount, c.currency)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <FilingBadge status={c.filing_status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
        active
          ? "bg-primary/10 font-semibold text-primary-text"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-xs ${active ? "text-primary-text" : "text-slate-500"}`}
      >
        {count}
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-300" />
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary-text"
      }`}
    >
      {label}
    </button>
  );
}

function FilingBadge({ status }: { status: string | null }) {
  if (!status || status === "not_filed") {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        Not filed
      </span>
    );
  }
  if (status === "filed_not_acknowledged") {
    return (
      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning-text">
        Filed · Not Ack
      </span>
    );
  }
  if (status === "acknowledged") {
    return (
      <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info-text">
        Acknowledged
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
        Closed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      {status}
    </span>
  );
}
