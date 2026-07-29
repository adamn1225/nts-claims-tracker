"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Loader2, ShieldOff } from "lucide-react";

type Hold = {
  id: string;
  hold_type: string;
  status: string;
  reason: string;
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  related_claim_id: string | null;
};

/**
 * CompanyHoldsPanel — read-only for now. Placing / releasing a hold is a
 * manager-approval workflow; the flow lives on the claim detail (via a
 * "Request Do Not Pay" action) rather than here. This panel just gives
 * the company profile a chronological hold history.
 */
export default function CompanyHoldsPanel({
  companyId,
}: {
  companyId: string;
}) {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("carrier_holds")
      .select(
        `id, hold_type, status, reason, notes,
         requested_at, approved_at, released_at, release_reason,
         related_claim_id`,
      )
      .eq("company_id", companyId)
      .order("requested_at", { ascending: false });
    if (err) setError(err.message);
    else setHolds((data ?? []) as Hold[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <ShieldOff className="h-4 w-4 text-danger" />
        Hold history ({holds.length})
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Do-not-pay, dispatch, and monitoring holds recorded against this
        company. Add or release holds from the claim detail page.
      </p>
      {error && (
        <div className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : holds.length === 0 ? (
        <p className="text-xs text-slate-500">No holds on record.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {holds.map((h) => (
            <li
              key={h.id}
              className="rounded-md border border-slate-200 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase tracking-wide">
                  {h.hold_type.replace(/_/g, " ")}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    h.status === "active" || h.status === "approved"
                      ? "bg-danger/10 text-danger"
                      : h.status === "released"
                        ? "bg-success/10 text-success"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {h.status}
                </span>
              </div>
              <p className="mt-1 text-slate-700">
                <AlertTriangle className="mr-1 inline h-3 w-3 text-warning-text" />
                {h.reason}
              </p>
              {h.notes && (
                <p className="mt-0.5 italic text-slate-500">{h.notes}</p>
              )}
              <p className="mt-1 text-[10px] text-slate-500">
                Requested {new Date(h.requested_at).toLocaleDateString()}
                {h.released_at
                  ? ` · Released ${new Date(h.released_at).toLocaleDateString()}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
