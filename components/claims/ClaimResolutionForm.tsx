"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

export const MIN_RESOLUTION_NOTE_LENGTH = 10;

const CLOSE_RESOLUTIONS = [
    { value: "paid_full", label: "Paid in full" },
    { value: "paid_partial", label: "Paid partially" },
    { value: "recovered", label: "Recovered (subrogation)" },
    { value: "concession", label: "Concession" },
    { value: "withdrawn", label: "Withdrawn by shipper" },
] as const;

// Subset of the `payment_source` enum surfaced at close-out. The full list
// is still available from the transactions panel after the claim is closed.
const PAYER_SOURCES = [
    { value: "nts", label: "Paid by NTS" },
    { value: "broker", label: "Paid by Broker" },
    { value: "insurance", label: "Paid by Insurance" },
    { value: "carrier", label: "Paid by Carrier" },
] as const;

type PayerSource = (typeof PAYER_SOURCES)[number]["value"];

export type ResolutionPayer = { source: PayerSource; amount: number };

type PayerRow = { source: PayerSource | ""; amount: string };

const PAID_RESOLUTIONS = new Set(["paid_full", "paid_partial"]);

function formatMoney(amount: number, currency: string) {
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

/**
 * Shared close/deny form body \u2014 used inside a Modal both from the claim
 * detail page (ClaimResolutionActions) and from the kanban card menu.
 */
export default function ClaimResolutionForm({
    mode,
    onCancel,
    onSubmit,
    saving,
    error,
    damageClaimAmount,
    currency,
}: {
    mode: "close" | "deny";
    onCancel: () => void;
    onSubmit: (
        resolution: string,
        notes: string,
        payers: ResolutionPayer[],
    ) => void;
    saving: boolean;
    error: string | null;
    damageClaimAmount?: number | null;
    currency?: string | null;
}) {
    const [resolution, setResolution] = useState<string>("");
    const [notes, setNotes] = useState("");
    const [payers, setPayers] = useState<PayerRow[]>([
        { source: "", amount: "" },
    ]);

    const ccy = currency || "USD";
    const showPayers = mode === "close" && PAID_RESOLUTIONS.has(resolution);

    const handleResolutionChange = (next: string) => {
        setResolution(next);
        if (next === "paid_full" && damageClaimAmount != null) {
            setPayers([{ source: "", amount: String(damageClaimAmount) }]);
        } else if (PAID_RESOLUTIONS.has(next)) {
            setPayers([{ source: "", amount: "" }]);
        }
    };

    const updatePayer = (idx: number, patch: Partial<PayerRow>) => {
        setPayers((rows) =>
            rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
        );
    };
    const addPayer = () =>
        setPayers((rows) => [...rows, { source: "", amount: "" }]);
    const removePayer = (idx: number) =>
        setPayers((rows) =>
            rows.length === 1 ? rows : rows.filter((_, i) => i !== idx),
        );

    const validPayers = useMemo<ResolutionPayer[]>(() => {
        return payers
            .filter((p) => p.source !== "" && Number(p.amount) > 0)
            .map((p) => ({
                source: p.source as PayerSource,
                amount: Number(p.amount),
            }));
    }, [payers]);

    const payerSum = useMemo(
        () => validPayers.reduce((acc, p) => acc + p.amount, 0),
        [validPayers],
    );

    const payerMismatch =
        resolution === "paid_full" &&
        damageClaimAmount != null &&
        validPayers.length > 0 &&
        Math.abs(payerSum - Number(damageClaimAmount)) > 0.005;

    const submitDisabled =
        saving ||
        notes.trim().length < MIN_RESOLUTION_NOTE_LENGTH ||
        (mode === "close" && resolution === "") ||
        (showPayers && validPayers.length === 0);

    const handleSubmit = () => {
        if (mode === "deny") {
            onSubmit("denied", notes, []);
            return;
        }
        onSubmit(resolution, notes, showPayers ? validPayers : []);
    };

    return (
        <div className="space-y-4 px-6 py-5">
            <p className="text-sm text-slate-600">
                {mode === "deny"
                    ? "This claim will move to Claim Denied and leave the working board. Explain why it was denied \u2014 this is kept on the claim's record."
                    : "This claim will move to Claim Closed and leave the working board. Summarize the outcome \u2014 this is kept on the claim's record."}
            </p>

            {mode === "close" && (
                <label className="block">
                    <span className="text-sm font-medium text-slate-700">
                        Resolution<span className="ml-0.5 text-danger">*</span>
                    </span>
                    <select
                        value={resolution}
                        onChange={(e) => handleResolutionChange(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        <option value="" disabled>
                            — Select resolution —
                        </option>
                        {CLOSE_RESOLUTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            {showPayers && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-700">
                                Who paid?
                                <span className="ml-0.5 text-danger">*</span>
                            </p>
                            <p className="text-xs text-slate-500">
                                Split across parties if more than one contributed. Each row is logged as a transaction on the claim.
                            </p>
                        </div>
                        {damageClaimAmount != null && (
                            <span className="shrink-0 text-xs text-slate-500">
                                Claim amount: {formatMoney(Number(damageClaimAmount), ccy)}
                            </span>
                        )}
                    </div>

                    <div className="space-y-2">
                        {payers.map((row, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <select
                                    value={row.source}
                                    onChange={(e) =>
                                        updatePayer(idx, {
                                            source: e.target.value as PayerSource | "",
                                        })
                                    }
                                    className="min-w-0 grow rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                    <option value="" disabled>
                                        — Select payer —
                                    </option>
                                    {PAYER_SOURCES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="relative w-36 shrink-0">
                                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                        $
                                    </span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="0.01"
                                        value={row.amount}
                                        onChange={(e) =>
                                            updatePayer(idx, { amount: e.target.value })
                                        }
                                        placeholder="0.00"
                                        className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-5 pr-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removePayer(idx)}
                                    disabled={payers.length === 1}
                                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Remove payer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={addPayer}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add payer
                        </button>
                        {validPayers.length > 0 && (
                            <span className="text-xs text-slate-500">
                                Total: {formatMoney(payerSum, ccy)}
                            </span>
                        )}
                    </div>

                    {payerMismatch && (
                        <p className="mt-2 text-xs text-warning-text">
                            Payer total doesn&apos;t match the claim amount. Adjust the amounts or switch the resolution to &quot;Paid partially&quot;.
                        </p>
                    )}
                </div>
            )}

            <label className="block">
                <span className="text-sm font-medium text-slate-700">
                    {mode === "deny" ? "Reason for denial" : "Outcome summary"}
                    <span className="ml-0.5 text-danger">*</span>
                </span>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder={
                        mode === "deny"
                            ? "e.g. No documented damage notation on the BOL at delivery; carrier liability could not be established."
                            : "e.g. Carrier paid $4,200 in full; release and payment confirmation on file."
                    }
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
            </label>

            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitDisabled}
                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${mode === "deny" ? "bg-danger hover:bg-danger/90" : "bg-success hover:bg-success/90"
                        }`}
                >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "deny" ? "Deny claim" : "Close claim"}
                </button>
            </div>
        </div>
    );
}
