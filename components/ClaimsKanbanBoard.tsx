"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  FileText,
  Flag,
  Loader2,
  MoreVertical,
  Pin,
  RefreshCw,
  ShieldX,
  Truck,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import ClaimResolutionForm, {
  MIN_RESOLUTION_NOTE_LENGTH,
} from "@/components/claims/ClaimResolutionForm";
import {
  ClaimStatus,
  ClaimValueBucket,
  ClaimWithDetails,
} from "@/lib/types";

// A claim as consumed by the board — pin fields are optional so the board
// still works if a caller doesn't wire up pinning.
export type PinnableClaim = ClaimWithDetails & {
  is_pinned?: boolean;
  pin_position?: number | null;
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Map a `claim_statuses.color` semantic token to Tailwind utility classes.
 * Tokens come from the seeded claim_statuses rows and align with the design
 * system in `app/globals.css`.
 */
const STATUS_COLOR_CLASSES: Record<
  string,
  { header: string; accent: string }
> = {
  info: { header: "bg-sky-50 border-sky-200", accent: "bg-sky-500" },
  warning: { header: "bg-amber-50 border-amber-200", accent: "bg-amber-500" },
  accent: { header: "bg-blue-50 border-blue-200", accent: "bg-blue-500" },
  primary: {
    header: "bg-orange-50 border-orange-200",
    accent: "bg-orange-500",
  },
  success: {
    header: "bg-emerald-50 border-emerald-200",
    accent: "bg-emerald-500",
  },
  danger: { header: "bg-red-50 border-red-200", accent: "bg-red-500" },
  critical: {
    header: "bg-violet-50 border-violet-200",
    accent: "bg-violet-500",
  },
};

const statusColorClasses = (color: string | null | undefined) =>
  STATUS_COLOR_CLASSES[color ?? ""] ?? {
    header: "bg-slate-50 border-slate-200",
    accent: "bg-slate-400",
  };

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

const ownerName = (
  owner: ClaimWithDetails["owner"],
): string | null => {
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

type AssignableUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

// ---------------------------------------------------------------------------
// Claim card
// ---------------------------------------------------------------------------

interface ClaimCardProps {
  claim: PinnableClaim;
  isDragOverlay?: boolean;
  assignableUsers?: AssignableUser[];
  onReassign?: (claimId: string, ownerId: string | null) => Promise<void> | void;
  onTogglePin?: (claimId: string) => Promise<void> | void;
  canResolve?: boolean;
  onRequestResolve?: (claim: PinnableClaim, mode: "close" | "deny") => void;
}

function ClaimCard({
  claim,
  isDragOverlay = false,
  assignableUsers,
  onReassign,
  onTogglePin,
  canResolve = false,
  onRequestResolve,
}: ClaimCardProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: claim.id,
    data: { type: "claim", claim },
    disabled: isDragOverlay,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `claim:${claim.id}`,
    data: { type: "claim", claim },
    disabled: isDragOverlay,
  });
  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };
  const [menuOpen, setMenuOpen] = useState(false);

  const shipper = partyName(claim, "shipper") ?? partyName(claim, "customer");
  const carrier = partyName(claim, "carrier");
  const carrierHold = claim.parties.some(
    (p) => p.role === "carrier" && p.company?.has_active_hold,
  );
  const owner = ownerName(claim.owner);
  const age = daysSince(claim.opened_at);
  const exposure = formatMoney(claim.damage_claim_amount, claim.currency);

  return (
    <div
      ref={isDragOverlay ? undefined : setRefs}
      {...(isDragOverlay ? {} : listeners)}
      {...(isDragOverlay ? {} : attributes)}
      className={`group relative rounded-lg border bg-white p-3 shadow-sm transition ${claim.is_pinned ? "border-warning/50 ring-1 ring-warning/30" : "border-slate-200"
        } ${isDragging && !isDragOverlay
          ? "opacity-40"
          : "hover:border-slate-300 hover:shadow-md"
        } ${isDragOverlay ? "rotate-1 cursor-grabbing shadow-lg" : "cursor-grab"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/dashboard/claims/${claim.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block font-mono text-sm font-semibold text-slate-900 hover:text-primary"
          >
            {claim.claim_number}
          </Link>
          {claim.bol_number && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <FileText className="h-3 w-3" />
              BOL {claim.bol_number}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(claim.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={claim.is_pinned ? "Unpin claim" : "Pin claim to top"}
              className={`rounded p-0.5 hover:bg-slate-100 ${claim.is_pinned ? "text-warning" : "text-slate-300 hover:text-slate-500"}`}
            >
              <Pin className="h-3.5 w-3.5" fill={claim.is_pinned ? "currentColor" : "none"} />
            </button>
          )}
          {canResolve && onRequestResolve && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Claim actions"
                className="rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 top-6 z-20 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRequestResolve(claim, "close");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Close claim
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRequestResolve(claim, "deny");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <ShieldX className="h-3.5 w-3.5 text-danger" />
                      Deny claim
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${VALUE_BUCKET_CLASSES[claim.value_bucket]}`}
          >
            {VALUE_BUCKET_LABEL[claim.value_bucket]}
          </span>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {shipper && (
          <div className="flex items-center gap-1.5 text-slate-700">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{shipper}</span>
          </div>
        )}
        {carrier && (
          <div className="flex items-center gap-1.5 text-slate-700">
            <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{carrier}</span>
            {carrierHold && (
              <span
                title="Carrier has an active hold"
                className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700"
              >
                <AlertTriangle className="h-3 w-3" />
                HOLD
              </span>
            )}
          </div>
        )}
        {exposure && (
          <div className="flex items-center gap-1.5 text-slate-700">
            <DollarSign className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{exposure}</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          {age != null ? `${age}d open` : "—"}
        </div>
        {onReassign && assignableUsers ? (
          <div
            className="min-w-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={claim.owner_id ?? ""}
              onChange={(e) => onReassign(claim.id, e.target.value || null)}
              title="Reassign claim owner"
              className="max-w-32 truncate rounded border-none bg-transparent text-right text-[11px] text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {ownerName(u) ?? "Unnamed"}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="truncate text-right">
            {owner ? owner : <span className="italic text-slate-400">Unassigned</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

interface ColumnProps {
  status: ClaimStatus;
  claims: PinnableClaim[];
  assignableUsers?: AssignableUser[];
  onReassignClaim?: (claimId: string, ownerId: string | null) => Promise<void> | void;
  onTogglePin?: (claimId: string) => Promise<void> | void;
  canResolve?: boolean;
  onRequestResolve?: (claim: PinnableClaim, mode: "close" | "deny") => void;
}

function Column({
  status,
  claims,
  assignableUsers,
  onReassignClaim,
  onTogglePin,
  canResolve,
  onRequestResolve,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status:${status.id}`,
    data: { type: "status", statusId: status.id },
  });

  const colors = statusColorClasses(status.color);

  // Pinned claims float to the top (ordered by pin_position); everything
  // else keeps whatever order the caller already sorted it into.
  const orderedClaims = useMemo(() => {
    const pinned = claims
      .filter((c) => c.is_pinned)
      .sort((a, b) => (a.pin_position ?? 0) - (b.pin_position ?? 0));
    const unpinned = claims.filter((c) => !c.is_pinned);
    return [...pinned, ...unpinned];
  }, [claims]);

  return (
    <div className="flex min-w-72 flex-1 flex-col">
      <div
        className={`flex items-center justify-between rounded-t-lg border px-3 py-2 ${colors.header}`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${colors.accent}`} />
          <span className="text-sm font-semibold text-slate-800">
            {status.name}
          </span>
          {status.is_denied && (
            <Flag className="h-3 w-3 text-red-500" aria-label="Denied stage" />
          )}
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
          {claims.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-50 flex-1 flex-col gap-2 rounded-b-lg border border-t-0 border-slate-200 bg-slate-50/70 p-2 transition ${isOver ? "ring-2 ring-primary/40 ring-offset-1" : ""
          }`}
      >
        {claims.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-xs italic text-slate-400">
            No claims
          </div>
        ) : (
          orderedClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              assignableUsers={assignableUsers}
              onReassign={onReassignClaim}
              onTogglePin={onTogglePin}
              canResolve={canResolve}
              onRequestResolve={onRequestResolve}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface ClaimsKanbanBoardProps {
  claims: PinnableClaim[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onMoveClaim: (claimId: string, newStatusId: string) => Promise<void> | void;
  assignableUsers?: AssignableUser[];
  onReassignClaim?: (claimId: string, ownerId: string | null) => Promise<void> | void;
  onTogglePin?: (claimId: string) => Promise<void> | void;
  onReorderPins?: (claimId: string, targetClaimId: string) => Promise<void> | void;
}

type SortMode = "recent" | "oldest" | "exposure";

const SORT_LABEL: Record<SortMode, string> = {
  recent: "Recently active",
  oldest: "Oldest first",
  exposure: "Highest exposure",
};

export default function ClaimsKanbanBoard({
  claims,
  isLoading = false,
  error = null,
  onRefresh,
  onMoveClaim,
  assignableUsers,
  onReassignClaim,
  onTogglePin,
  onReorderPins,
}: ClaimsKanbanBoardProps) {
  const [statuses, setStatuses] = useState<ClaimStatus[]>([]);
  const [statusesError, setStatusesError] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<PinnableClaim | null>(
    null,
  );
  const [assigneeFilters, setAssigneeFilters] = useState<Set<string>>(new Set());
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);
  const [valueBucketFilter, setValueBucketFilter] = useState<"" | ClaimValueBucket>("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [canResolve, setCanResolve] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<{
    claim: PinnableClaim;
    mode: "close" | "deny";
  } | null>(null);

  // Status columns come straight from the DB so re-ordering / renaming /
  // toggling is_active is a DB-only operation. Closed/denied statuses are
  // deliberately excluded from the board — this is a focused working view,
  // and resolving a claim happens through the Close/Deny actions on the
  // claim page instead of a drag-and-drop (see ClaimResolutionActions).
  const [allActiveStatuses, setAllActiveStatuses] = useState<ClaimStatus[]>([]);
  useEffect(() => {
    const loadStatuses = async () => {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from("claim_statuses")
        .select("*")
        .eq("is_active", true)
        .order("position");

      if (fetchErr) {
        console.error("[ClaimsKanbanBoard] failed to load statuses:", fetchErr);
        setStatusesError(fetchErr.message);
        setAllActiveStatuses([]);
        setStatuses([]);
        return;
      }
      setStatusesError(null);
      const all = (data ?? []) as ClaimStatus[];
      setAllActiveStatuses(all);
      setStatuses(all.filter((s) => !s.is_closed && !s.is_denied));
    };
    loadStatuses();
  }, []);

  const resolvedStatusIds = useMemo(
    () =>
      new Set(
        allActiveStatuses
          .filter((s) => s.is_closed || s.is_denied)
          .map((s) => s.id),
      ),
    [allActiveStatuses],
  );

  const claimsByStatus = useMemo(() => {
    let scoped =
      assigneeFilters.size === 0
        ? claims
        : claims.filter((c) =>
          c.owner_id
            ? assigneeFilters.has(c.owner_id)
            : assigneeFilters.has("__unassigned__"),
        );

    if (valueBucketFilter) {
      scoped = scoped.filter((c) => c.value_bucket === valueBucketFilter);
    }

    const sorted = [...scoped].sort((a, b) => {
      if (sortMode === "oldest") {
        return (
          new Date(a.opened_at ?? 0).getTime() -
          new Date(b.opened_at ?? 0).getTime()
        );
      }
      if (sortMode === "exposure") {
        return (b.damage_claim_amount ?? 0) - (a.damage_claim_amount ?? 0);
      }
      // "recent" — the incoming array is already ordered by last_activity_at
      // desc from the fetch; keep that order.
      return 0;
    });

    const grouped: Record<string, PinnableClaim[]> = {};
    for (const status of statuses) {
      grouped[status.id] = [];
    }
    for (const claim of sorted) {
      if (resolvedStatusIds.has(claim.status_id)) {
        // Closed/denied — intentionally left off the working board.
        continue;
      }
      if (!grouped[claim.status_id]) {
        // Claim is in a status that's no longer active — bucket it so it
        // doesn't disappear. We render an "Other" pseudo-column for these.
        grouped["__orphan__"] = grouped["__orphan__"] ?? [];
        grouped["__orphan__"].push(claim);
        continue;
      }
      grouped[claim.status_id].push(claim);
    }
    return grouped;
  }, [claims, statuses, assigneeFilters, valueBucketFilter, sortMode, resolvedStatusIds]);

  const resolvedClaimCount = useMemo(
    () => claims.filter((c) => resolvedStatusIds.has(c.status_id)).length,
    [claims, resolvedStatusIds],
  );

  // Self-fetched role gate for the close/deny quick actions, mirroring the
  // component's existing self-contained data-fetching style for statuses.
  useEffect(() => {
    const loadRole = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setCanResolve(
        Boolean(
          data && ["admin", "manager", "claims_staff"].includes(data.role),
        ),
      );
    };
    loadRole();
  }, []);

  // Close the assignee multi-select popover on outside click.
  useEffect(() => {
    if (!assigneeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!assigneeMenuRef.current?.contains(e.target as Node)) {
        setAssigneeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [assigneeMenuOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const claim = event.active.data.current?.claim as
      | PinnableClaim
      | undefined;
    setActiveClaim(claim ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveClaim(null);
    const { active, over } = event;
    if (!over) return;
    const claim = active.data.current?.claim as PinnableClaim | undefined;
    if (!claim) return;

    const overType = over.data.current?.type as string | undefined;

    if (overType === "claim") {
      const targetClaim = over.data.current?.claim as PinnableClaim | undefined;
      if (
        targetClaim &&
        targetClaim.id !== claim.id &&
        claim.is_pinned &&
        targetClaim.is_pinned &&
        claim.status_id === targetClaim.status_id &&
        onReorderPins
      ) {
        await onReorderPins(claim.id, targetClaim.id);
        return;
      }
      // Dropped on an unpinned/other-column card — fall back to moving into
      // that card's status column.
      if (targetClaim && claim.status_id !== targetClaim.status_id) {
        await onMoveClaim(claim.id, targetClaim.status_id);
      }
      return;
    }

    const statusId = over.data.current?.statusId as string | undefined;
    if (!statusId || claim.status_id === statusId) return;
    await onMoveClaim(claim.id, statusId);
  };

  // ---- header -------------------------------------------------------------
  const totalClaims = Object.values(claimsByStatus).reduce(
    (sum, group) => sum + group.length,
    0,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Claims Pipeline
          </h1>
          <p className="text-xs text-slate-500">
            {isLoading
              ? "Loading claims…"
              : `${totalClaims} ${totalClaims === 1 ? "claim" : "claims"} across ${statuses.length} stages`}
            {!isLoading && resolvedClaimCount > 0 && (
              <>
                {" · "}
                <Link
                  href="/dashboard/claims/list"
                  className="text-primary hover:underline"
                >
                  {resolvedClaimCount} closed/denied off-board
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assignableUsers && assignableUsers.length > 0 && (
            <div className="relative" ref={assigneeMenuRef}>
              <button
                type="button"
                onClick={() => setAssigneeMenuOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Assignees
                {assigneeFilters.size > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                    {assigneeFilters.size}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {assigneeMenuOpen && (
                <div className="absolute left-0 top-10 z-30 w-56 rounded-md border border-slate-200 bg-white py-1.5 shadow-lg">
                  <div className="flex items-center justify-between px-3 pb-1.5">
                    <span className="text-xs font-semibold text-slate-500">
                      Claims representatives
                    </span>
                    {assigneeFilters.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setAssigneeFilters(new Set())}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={assigneeFilters.has("__unassigned__")}
                        onChange={() =>
                          setAssigneeFilters((prev) => {
                            const next = new Set(prev);
                            if (next.has("__unassigned__")) next.delete("__unassigned__");
                            else next.add("__unassigned__");
                            return next;
                          })
                        }
                      />
                      Unassigned
                    </label>
                    {assignableUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={assigneeFilters.has(u.id)}
                          onChange={() =>
                            setAssigneeFilters((prev) => {
                              const next = new Set(prev);
                              if (next.has(u.id)) next.delete(u.id);
                              else next.add(u.id);
                              return next;
                            })
                          }
                        />
                        {ownerName(u) ?? "Unnamed"}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <select
            value={valueBucketFilter}
            onChange={(e) => setValueBucketFilter(e.target.value as "" | ClaimValueBucket)}
            title="Filter by value bucket"
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
          >
            <option value="">All value buckets</option>
            <option value="current">Current</option>
            <option value="credit_high_value">Credit / High Value</option>
            <option value="legal">Legal</option>
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            title="Sort claims"
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
          >
            {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABEL[mode]}
              </option>
            ))}
          </select>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          )}
        </div>
      </div>

      {(error || statusesError) && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error || statusesError}
        </div>
      )}

      {isLoading && statuses.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
            {statuses.map((status) => (
              <div key={status.id} className="flex min-w-72 flex-1">
                <Column
                  status={status}
                  claims={claimsByStatus[status.id] ?? []}
                  assignableUsers={assignableUsers}
                  onReassignClaim={onReassignClaim}
                  onTogglePin={onTogglePin}
                  canResolve={canResolve}
                  onRequestResolve={(claim, mode) => setResolveTarget({ claim, mode })}
                />
              </div>
            ))}
            {claimsByStatus["__orphan__"]?.length ? (
              <Column
                key="__orphan__"
                status={
                  {
                    id: "__orphan__",
                    name: "Other (inactive stage)",
                    color: null,
                    position: 999,
                    is_inbox: false,
                    is_closed: false,
                    is_denied: false,
                    is_system: false,
                    is_active: false,
                    description: null,
                    created_at: "",
                    updated_at: "",
                  } as unknown as ClaimStatus
                }
                claims={claimsByStatus["__orphan__"]}
                assignableUsers={assignableUsers}
                onReassignClaim={onReassignClaim}
                onTogglePin={onTogglePin}
                canResolve={canResolve}
                onRequestResolve={(claim, mode) => setResolveTarget({ claim, mode })}
              />
            ) : null}
          </div>

          <DragOverlay>
            {activeClaim ? (
              <div className="w-72">
                <ClaimCard claim={activeClaim} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {resolveTarget && (
        <ClaimResolveModal
          claim={resolveTarget.claim}
          mode={resolveTarget.mode}
          onClose={() => setResolveTarget(null)}
          onResolved={() => {
            setResolveTarget(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Close/deny modal — board-scoped variant of ClaimResolutionActions that
// refreshes via the board's own data hook instead of router.refresh().
// ---------------------------------------------------------------------------

function ClaimResolveModal({
  claim,
  mode,
  onClose,
  onResolved,
}: {
  claim: PinnableClaim;
  mode: "close" | "deny";
  onClose: () => void;
  onResolved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (resolution: string, notes: string) => {
    if (notes.trim().length < MIN_RESOLUTION_NOTE_LENGTH) {
      setError(`Please add a brief explanation (at least ${MIN_RESOLUTION_NOTE_LENGTH} characters).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claim.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, resolution, resolution_notes: notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Unable to update claim");
      window.dispatchEvent(
        new CustomEvent("claim-activity-updated", { detail: { claimId: claim.id } }),
      );
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${mode === "deny" ? "Deny" : "Close"} ${claim.claim_number}`}
    >
      <ClaimResolutionForm
        mode={mode}
        onCancel={onClose}
        onSubmit={submit}
        saving={saving}
        error={error}
      />
    </Modal>
  );
}
