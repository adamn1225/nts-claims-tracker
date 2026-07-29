"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

// Kept in sync with the enums in migration 20260728000001_meeting_features.sql.
const TRANSACTION_TYPES = [
  { value: "inbound_payment", label: "Inbound payment (money in)" },
  { value: "outbound_payment", label: "Outbound payment (money out)" },
  { value: "concession", label: "Concession granted" },
  { value: "adjustment", label: "Adjustment / write-off" },
  { value: "recovery", label: "Recovery / subrogation" },
  { value: "direct_payment", label: "Direct payment (party-to-party)" },
] as const;

const PAYMENT_SOURCES = [
  { value: "carrier", label: "Carrier" },
  { value: "insurance", label: "Insurance" },
  { value: "nts", label: "NTS" },
  { value: "broker", label: "Broker" },
  { value: "shipper", label: "Shipper" },
  { value: "customer", label: "Customer" },
  { value: "factoring", label: "Factoring" },
  { value: "unknown", label: "Unknown" },
  { value: "other", label: "Other" },
] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number]["value"];
type PaymentSource = (typeof PAYMENT_SOURCES)[number]["value"];

type ClaimTransaction = {
  id: string;
  transaction_type: TransactionType;
  payment_source: PaymentSource;
  amount: number;
  currency: string;
  transaction_date: string;
  gl_code: string | null;
  reference_number: string | null;
  notes: string | null;
  from_party_id: string | null;
  to_party_id: string | null;
  created_at: string;
};

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
}

function typeLabel(t: TransactionType) {
  return TRANSACTION_TYPES.find((x) => x.value === t)?.label ?? t;
}
function sourceLabel(s: PaymentSource) {
  return PAYMENT_SOURCES.find((x) => x.value === s)?.label ?? s;
}

const INBOUND_TYPES: TransactionType[] = [
  "inbound_payment",
  "recovery",
  "concession",
  "direct_payment",
];

export interface ClaimTransactionsPanelProps {
  claimId: string;
  currency: string | null | undefined;
  damageClaimAmount: number | null | undefined;
  canEdit: boolean;
}

/**
 * ClaimTransactionsPanel
 *
 * Displays the ledger of payments/concessions/adjustments logged against a
 * claim, plus an inline form to add new entries. Directly addresses P5 in
 * the discovery doc: staff want to record "who paid" (carrier / insurance /
 * NTS / broker) at the moment of the transaction, not at close-out.
 *
 * Also renders a running rollup (Paid / Concession / Direct / Unpaid) so
 * the claims team gets FreightClaims-Insights-style breakdown without
 * navigating away.
 */
export default function ClaimTransactionsPanel({
  claimId,
  currency,
  damageClaimAmount,
  canEdit,
}: ClaimTransactionsPanelProps) {
  const [transactions, setTransactions] = useState<ClaimTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const ccy = currency || "USD";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/transactions`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load transactions");
      setTransactions(json.transactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  const rollup = useMemo(() => {
    const buckets = {
      paid: 0,
      concession: 0,
      direct: 0,
      recovery: 0,
      outbound: 0,
    };
    for (const t of transactions) {
      switch (t.transaction_type) {
        case "inbound_payment":
          buckets.paid += Number(t.amount);
          break;
        case "concession":
          buckets.concession += Number(t.amount);
          break;
        case "direct_payment":
          buckets.direct += Number(t.amount);
          break;
        case "recovery":
          buckets.recovery += Number(t.amount);
          break;
        case "outbound_payment":
          buckets.outbound += Number(t.amount);
          break;
        default:
          break;
      }
    }
    const totalClaimAmt = Number(damageClaimAmount ?? 0);
    const applied = buckets.paid + buckets.concession + buckets.direct;
    return {
      ...buckets,
      unpaid: Math.max(totalClaimAmt - applied, 0),
      totalClaimAmt,
    };
  }, [transactions, damageClaimAmount]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/claims/${claimId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_type: fd.get("transaction_type"),
          payment_source: fd.get("payment_source"),
          amount: Number(fd.get("amount")),
          currency: (fd.get("currency") as string) || "USD",
          transaction_date: fd.get("transaction_date") || undefined,
          gl_code: fd.get("gl_code") || null,
          reference_number: fd.get("reference_number") || null,
          notes: fd.get("notes") || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to log transaction");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (txnId: string) => {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    try {
      const res = await fetch(
        `/api/claims/${claimId}/transactions?txn_id=${encodeURIComponent(txnId)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Transactions
          </h2>
          <p className="text-xs text-slate-500">
            Per-payment ledger. Feeds reports and the financial summary.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text"
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? "Cancel" : "Log transaction"}
          </button>
        )}
      </div>

      {/* Rollup — FreightClaims-Insights-style horizontal legend */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <RollupTile label="Paid" value={rollup.paid} ccy={ccy} tone="success" />
        <RollupTile
          label="Concession"
          value={rollup.concession}
          ccy={ccy}
          tone="accent"
        />
        <RollupTile
          label="Direct pay"
          value={rollup.direct}
          ccy={ccy}
          tone="info"
        />
        <RollupTile
          label="Recovery"
          value={rollup.recovery}
          ccy={ccy}
          tone="critical"
        />
        <RollupTile
          label="Unpaid"
          value={rollup.unpaid}
          ccy={ccy}
          tone="warning"
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {showForm && canEdit && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
        >
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Transaction type
            </span>
            <select
              name="transaction_type"
              required
              defaultValue="inbound_payment"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Payment source
            </span>
            <select
              name="payment_source"
              required
              defaultValue="carrier"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {PAYMENT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">Amount</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Currency
            </span>
            <input
              name="currency"
              type="text"
              maxLength={3}
              defaultValue={ccy}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm uppercase"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">Date</span>
            <input
              name="transaction_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Reference #
            </span>
            <input
              name="reference_number"
              type="text"
              placeholder="Check #, wire ref, etc."
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              GL code (optional)
            </span>
            <input
              name="gl_code"
              type="text"
              placeholder="e.g. 5210-CARRIER-CLAIMS"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">
          No transactions logged yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {transactions.map((t) => {
            const inbound = INBOUND_TYPES.includes(t.transaction_type);
            return (
              <li key={t.id} className="flex items-start gap-3 py-2.5">
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    inbound
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning-text"
                  }`}
                >
                  {inbound ? (
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {fmtMoney(Number(t.amount), t.currency)}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        · {sourceLabel(t.payment_source)}
                      </span>
                    </p>
                    <span className="text-xs text-slate-500">
                      {t.transaction_date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {typeLabel(t.transaction_type)}
                    {t.reference_number ? ` · Ref ${t.reference_number}` : ""}
                    {t.gl_code ? ` · GL ${t.gl_code}` : ""}
                  </p>
                  {t.notes && (
                    <p className="mt-0.5 text-xs italic text-slate-500">
                      {t.notes}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    aria-label="Delete transaction"
                    className="rounded p-1 text-slate-400 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RollupTile({
  label,
  value,
  ccy,
  tone,
}: {
  label: string;
  value: number;
  ccy: string;
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
    <div
      className={`rounded-md border px-2 py-1.5 ${toneClass[tone]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
        <DollarSign className="h-3 w-3 opacity-60" />
        {fmtMoney(value, ccy).replace(/^\$/, "")}
      </p>
    </div>
  );
}
