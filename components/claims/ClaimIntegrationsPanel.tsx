"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  ShieldCheck,
  Truck,
} from "lucide-react";

type CarrierParty = {
  id: string;
  company_id: string;
  company_name: string;
  dot_number: string | null;
  mc_number: string | null;
};

export interface ClaimIntegrationsPanelProps {
  claimId: string;
  carrierParties: CarrierParty[];
  existingCentralDispatchOrder: string | null;
  canEdit: boolean;
}

/**
 * ClaimIntegrationsPanel
 *
 * Scaffolds the two external integrations the team asked about:
 *
 *   - **Descartes MCP** (My Carrier Portal) — carrier verification lookup.
 *   - **Central Dispatch** — cross-link the CD order that spawned the load.
 *
 * Both currently run through mock clients under `lib/integrations/*`. UI
 * shows a "Sandbox / mock data" indicator so the team knows the numbers
 * aren't live yet.
 */
export default function ClaimIntegrationsPanel({
  claimId,
  carrierParties,
  existingCentralDispatchOrder,
  canEdit,
}: ClaimIntegrationsPanelProps) {
  const [mcpBusy, setMcpBusy] = useState<string | null>(null); // party id being verified
  const [mcpResult, setMcpResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpLive, setMcpLive] = useState(false);

  const [cdOrder, setCdOrder] = useState(existingCentralDispatchOrder ?? "");
  const [cdBusy, setCdBusy] = useState(false);
  const [cdResult, setCdResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [cdError, setCdError] = useState<string | null>(null);
  const [cdLive, setCdLive] = useState(false);

  const handleMcpVerify = async (party: CarrierParty) => {
    setMcpBusy(party.id);
    setMcpError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/mcp-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: party.company_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Verification failed");
      setMcpResult(json.verification);
      setMcpLive(Boolean(json.live));
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpBusy(null);
    }
  };

  const handleCdLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cdOrder.trim()) return;
    setCdBusy(true);
    setCdError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/central-dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: cdOrder.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Link failed");
      setCdResult(json.order);
      setCdLive(Boolean(json.live));
    } catch (err) {
      setCdError(err instanceof Error ? err.message : String(err));
    } finally {
      setCdBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Integrations
        </h2>
        <p className="text-xs text-slate-500">
          Descartes MCP and Central Dispatch are scaffolded — showing
          mock data until credentials are provisioned.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Descartes MCP                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-slate-900">
              Descartes MCP — Carrier verification
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              mcpLive
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning-text"
            }`}
          >
            {mcpLive ? "Live" : "Sandbox / mock"}
          </span>
        </div>

        {carrierParties.length === 0 ? (
          <p className="text-xs text-slate-500">
            No carrier parties attached to this claim yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {carrierParties.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {p.company_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.mc_number ? `MC ${p.mc_number}` : "MC —"}
                    {" · "}
                    {p.dot_number ? `DOT ${p.dot_number}` : "DOT —"}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleMcpVerify(p)}
                    disabled={mcpBusy === p.id}
                    className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {mcpBusy === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3 w-3" />
                    )}
                    Verify
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {mcpError && (
          <div className="mt-2 flex items-start gap-1 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {mcpError}
          </div>
        )}

        {mcpResult && (
          <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-2 text-xs">
            <p className="mb-1 flex items-center gap-1 font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verification recorded
            </p>
            <ResultKV data={mcpResult} keys={[
              "legal_name",
              "dot_number",
              "mc_number",
              "insurance_carrier",
              "insurance_expiry",
              "operating_status",
              "status",
            ]} />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Central Dispatch                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-slate-900">
              Central Dispatch — Source order
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              cdLive
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning-text"
            }`}
          >
            {cdLive ? "Live" : "Sandbox / mock"}
          </span>
        </div>

        {canEdit ? (
          <form onSubmit={handleCdLink} className="flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={cdOrder}
                onChange={(e) => setCdOrder(e.target.value)}
                placeholder="Central Dispatch order number"
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={cdBusy || !cdOrder.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
            >
              {cdBusy && <Loader2 className="h-3 w-3 animate-spin" />}
              Link
            </button>
          </form>
        ) : existingCentralDispatchOrder ? (
          <p className="text-sm text-slate-700">
            Order:{" "}
            <span className="font-mono">{existingCentralDispatchOrder}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-500">No CD order linked.</p>
        )}

        {cdError && (
          <div className="mt-2 flex items-start gap-1 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {cdError}
          </div>
        )}

        {cdResult && (
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
            <p className="mb-1 flex items-center gap-1 font-semibold text-primary-text">
              <ExternalLink className="h-3.5 w-3.5" />
              Order linked
            </p>
            <ResultKV
              data={cdResult}
              keys={[
                "order_number",
                "status",
                "origin_city",
                "destination_city",
                "carrier_name",
                "carrier_mc",
                "pickup_date",
                "delivery_date",
                "total_price",
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ResultKV({
  data,
  keys,
}: {
  data: Record<string, unknown>;
  keys: string[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
      {keys.map((k) => {
        const v = data[k];
        if (v === null || v === undefined || v === "") return null;
        return (
          <div key={k} className="flex gap-1.5">
            <dt className="text-slate-500">{k.replace(/_/g, " ")}:</dt>
            <dd className="font-medium text-slate-900">{String(v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
