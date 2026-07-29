"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Loader2, Tag, UserCheck } from "lucide-react";
import { CLAIM_TYPES, claimTypeLabel } from "@/lib/constants/claim-types";

type Owner = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  office_location: string | null;
};

const FILING_OPTIONS = [
  { value: "not_filed", label: "Not filed", tone: "slate" },
  { value: "filed_not_acknowledged", label: "Filed · not acknowledged", tone: "warning" },
  { value: "acknowledged", label: "Acknowledged by carrier", tone: "info" },
  { value: "closed", label: "Filing closed", tone: "success" },
] as const;

type FilingStatus = (typeof FILING_OPTIONS)[number]["value"];

export interface ClaimHeaderActionsProps {
  claimId: string;
  currentOwnerId: string | null;
  currentOwnerName: string;
  currentFilingStatus: FilingStatus | null;
  currentFiledAt: string | null;
  currentClaimType: string | null;
  assignableUsers: Owner[];
  canEdit: boolean;
}

/**
 * Header-level actions on the claim detail page:
 *  - Assign / reassign owner
 *  - Update FreightClaims-style filing status
 *
 * Both write directly via API routes and refresh the server component so
 * downstream server-rendered fields (owner name, filing badge, filed_at)
 * stay in sync without a manual reload.
 */
export default function ClaimHeaderActions({
  claimId,
  currentOwnerId,
  currentOwnerName,
  currentFilingStatus,
  currentFiledAt,
  currentClaimType,
  assignableUsers,
  canEdit,
}: ClaimHeaderActionsProps) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [updatingFiling, setUpdatingFiling] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);

  const filingStatus =
    (currentFilingStatus ?? "not_filed") as FilingStatus;
  const filingLabel =
    FILING_OPTIONS.find((f) => f.value === filingStatus)?.label ?? filingStatus;
  const filingTone =
    FILING_OPTIONS.find((f) => f.value === filingStatus)?.tone ?? "slate";

  const toneClass: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    warning: "bg-warning/10 text-warning-text",
    info: "bg-info/10 text-info-text",
    success: "bg-success/10 text-success",
  };

  const changeOwner = async (nextId: string | null) => {
    setOwnerOpen(false);
    if (nextId === currentOwnerId) return;
    setAssigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: nextId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Assign failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssigning(false);
    }
  };

  const changeFilingStatus = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next = e.target.value as FilingStatus;
    setUpdatingFiling(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/filing-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filing_status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingFiling(false);
    }
  };

  const changeClaimType = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value || null;
    setUpdatingType(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/claim-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_type: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingType(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Owner assignment */}
      <div className="relative">
        <button
          type="button"
          onClick={() => canEdit && setOwnerOpen((v) => !v)}
          disabled={!canEdit || assigning}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {assigning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UserCheck className="h-3 w-3 text-slate-400" />
          )}
          {currentOwnerName}
          {canEdit && <ChevronDown className="h-3 w-3" />}
        </button>
        {ownerOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => changeOwner(null)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs italic text-slate-500 hover:bg-slate-50"
            >
              Unassigned (return to queue)
            </button>
            {assignableUsers.map((u) => {
              const name =
                `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
                u.email ||
                "Unnamed";
              const isCurrent = u.id === currentOwnerId;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => changeOwner(u.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 ${
                    isCurrent ? "bg-primary/5 font-semibold" : ""
                  }`}
                >
                  {isCurrent && (
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  )}
                  <span className="flex-1 text-left">{name}</span>
                  {u.office_location && (
                    <span className="text-[10px] text-slate-400">
                      {u.office_location}
                    </span>
                  )}
                  {u.role && (
                    <span className="text-[10px] uppercase text-slate-400">
                      {u.role.replace(/_/g, " ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filing status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass[filingTone]}`}
        >
          {filingLabel}
        </span>
        {canEdit && (
          <div className="relative">
            <select
              value={filingStatus}
              onChange={changeFilingStatus}
              disabled={updatingFiling}
              className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs disabled:opacity-50"
            >
              {FILING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {updatingFiling && (
              <Loader2 className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 animate-spin text-slate-400" />
            )}
          </div>
        )}
        {currentFiledAt && (
          <span className="text-[11px] text-slate-500">
            filed {new Date(currentFiledAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Claim type */}
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
          <Tag className="h-2.5 w-2.5" />
          {claimTypeLabel(currentClaimType)}
        </span>
        {canEdit && (
          <div className="relative">
            <select
              value={currentClaimType ?? ""}
              onChange={changeClaimType}
              disabled={updatingType}
              className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs disabled:opacity-50"
            >
              <option value="">— Set claim type —</option>
              {CLAIM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {updatingType && (
              <Loader2 className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 animate-spin text-slate-400" />
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="ml-2 text-[11px] text-danger">{error}</div>
      )}
    </div>
  );
}
