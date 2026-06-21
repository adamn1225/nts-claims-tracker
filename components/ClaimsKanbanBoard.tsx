"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  DollarSign,
  FileText,
  Flag,
  Loader2,
  Plus,
  RefreshCw,
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
import {
  ClaimStatus,
  ClaimValueBucket,
  ClaimWithDetails,
} from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Claim card
// ---------------------------------------------------------------------------

interface ClaimCardProps {
  claim: ClaimWithDetails;
  isDragOverlay?: boolean;
}

function ClaimCard({ claim, isDragOverlay = false }: ClaimCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: claim.id,
    data: { type: "claim", claim },
    disabled: isDragOverlay,
  });

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
      ref={isDragOverlay ? undefined : setNodeRef}
      {...(isDragOverlay ? {} : listeners)}
      {...(isDragOverlay ? {} : attributes)}
      className={`group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition ${
        isDragging && !isDragOverlay
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
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${VALUE_BUCKET_CLASSES[claim.value_bucket]}`}
        >
          {VALUE_BUCKET_LABEL[claim.value_bucket]}
        </span>
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
        <div className="truncate text-right">
          {owner ? owner : <span className="italic text-slate-400">Unassigned</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

interface ColumnProps {
  status: ClaimStatus;
  claims: ClaimWithDetails[];
}

function Column({ status, claims }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status:${status.id}`,
    data: { type: "status", statusId: status.id },
  });

  const colors = statusColorClasses(status.color);

  return (
    <div className="flex w-72 shrink-0 flex-col">
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
        className={`flex min-h-[200px] flex-1 flex-col gap-2 rounded-b-lg border border-t-0 border-slate-200 bg-slate-50/70 p-2 transition ${
          isOver ? "ring-2 ring-primary/40 ring-offset-1" : ""
        }`}
      >
        {claims.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-xs italic text-slate-400">
            No claims
          </div>
        ) : (
          claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface ClaimsKanbanBoardProps {
  claims: ClaimWithDetails[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onAddClaim?: () => void;
  onMoveClaim: (claimId: string, newStatusId: string) => Promise<void> | void;
}

export default function ClaimsKanbanBoard({
  claims,
  isLoading = false,
  error = null,
  onRefresh,
  onAddClaim,
  onMoveClaim,
}: ClaimsKanbanBoardProps) {
  const [statuses, setStatuses] = useState<ClaimStatus[]>([]);
  const [statusesError, setStatusesError] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<ClaimWithDetails | null>(
    null,
  );

  // Status columns come straight from the DB so re-ordering / renaming /
  // toggling is_active is a DB-only operation.
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
        setStatuses([]);
        return;
      }
      setStatusesError(null);
      setStatuses((data ?? []) as ClaimStatus[]);
    };
    loadStatuses();
  }, []);

  const claimsByStatus = useMemo(() => {
    const grouped: Record<string, ClaimWithDetails[]> = {};
    for (const status of statuses) {
      grouped[status.id] = [];
    }
    for (const claim of claims) {
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
  }, [claims, statuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const claim = event.active.data.current?.claim as
      | ClaimWithDetails
      | undefined;
    setActiveClaim(claim ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveClaim(null);
    const { active, over } = event;
    if (!over) return;
    const claim = active.data.current?.claim as ClaimWithDetails | undefined;
    const statusId = over.data.current?.statusId as string | undefined;
    if (!claim || !statusId) return;
    if (claim.status_id === statusId) return;
    await onMoveClaim(claim.id, statusId);
  };

  // ---- header -------------------------------------------------------------
  const totalClaims = claims.length;

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
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          )}
          {onAddClaim && (
            <button
              type="button"
              onClick={onAddClaim}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Claim
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
              <Column
                key={status.id}
                status={status}
                claims={claimsByStatus[status.id] ?? []}
              />
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
    </div>
  );
}
