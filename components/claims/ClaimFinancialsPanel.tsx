"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";

type FinancialValues = {
    damage_claim_amount: number | null;
    shipment_value: number | null;
    carrier_pay: number | null;
    carrier_deductible: number | null;
};

type FinancialField = keyof FinancialValues;

const FIELDS: Array<{ name: FinancialField; label: string }> = [
    { name: "damage_claim_amount", label: "Estimated claim amount" },
    { name: "shipment_value", label: "Total shipment value" },
    { name: "carrier_pay", label: "Carrier pay" },
    { name: "carrier_deductible", label: "Carrier deductible" },
];

const VALUE_BUCKET_LABELS: Record<string, string> = {
    current: "Current (<$10K)",
    credit_high_value: "Credit / High Value",
    legal: "Legal",
};

function formatMoney(value: number | null, currency: string): string {
    if (value === null) return "—";
    return value.toLocaleString("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    });
}

function toFormValues(values: FinancialValues): Record<FinancialField, string> {
    return Object.fromEntries(
        FIELDS.map(({ name }) => [name, values[name]?.toString() ?? ""]),
    ) as Record<FinancialField, string>;
}

export default function ClaimFinancialsPanel({
    claimId,
    currency,
    initialValues,
    valueBucketLabel,
    resolution,
    resolutionNotes,
    canEdit,
}: {
    claimId: string;
    currency: string;
    initialValues: FinancialValues;
    valueBucketLabel: string;
    resolution: string | null;
    resolutionNotes: string | null;
    canEdit: boolean;
}) {
    const [values, setValues] = useState(initialValues);
    const [bucketLabel, setBucketLabel] = useState(valueBucketLabel);
    const [formValues, setFormValues] = useState(() => toFormValues(initialValues));
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cancel = () => {
        setFormValues(toFormValues(values));
        setError(null);
        setEditing(false);
    };

    const save = async () => {
        const next = {} as FinancialValues;
        for (const { name } of FIELDS) {
            const raw = formValues[name].trim();
            const parsed = raw === "" ? null : Number(raw);
            if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
                setError("Financial amounts must be zero or greater.");
                return;
            }
            next[name] = parsed;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/claims/${claimId}/financials`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(next),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Unable to save financials");
            const saved = result.claim as FinancialValues & { value_bucket: string };
            setValues({
                damage_claim_amount: saved.damage_claim_amount,
                shipment_value: saved.shipment_value,
                carrier_pay: saved.carrier_pay,
                carrier_deductible: saved.carrier_deductible,
            });
            setFormValues(toFormValues(saved));
            setBucketLabel(VALUE_BUCKET_LABELS[saved.value_bucket] ?? saved.value_bucket);
            setEditing(false);
            window.dispatchEvent(
                new CustomEvent("claim-activity-updated", { detail: { claimId } }),
            );
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : String(saveError));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Financials</h2>
                {canEdit && !editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary sm:min-h-9"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                    </button>
                )}
            </div>

            {editing ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {FIELDS.map(({ name, label }) => (
                            <label key={name} className="block">
                                <span className="text-sm font-medium text-slate-700">{label}</span>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
                                        $
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={formValues[name]}
                                        onChange={(event) =>
                                            setFormValues((current) => ({
                                                ...current,
                                                [name]: event.target.value,
                                            }))
                                        }
                                        className="min-w-0 flex-1 rounded-r-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                            </label>
                        ))}
                    </div>
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={cancel}
                            disabled={saving}
                            className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-9"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 sm:min-h-9"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save changes
                        </button>
                    </div>
                </div>
            ) : (
                <dl className="space-y-1.5 text-sm">
                    {FIELDS.map(({ name, label }) => (
                        <div key={name} className="grid grid-cols-1 gap-x-4 sm:grid-cols-[12rem_1fr]">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="text-slate-900">{formatMoney(values[name], currency)}</dd>
                        </div>
                    ))}
                    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[12rem_1fr]">
                        <dt className="text-slate-500">Value bucket</dt>
                        <dd className="text-slate-900">{bucketLabel}</dd>
                    </div>
                    {resolution && (
                        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[12rem_1fr]">
                            <dt className="text-slate-500">Resolution</dt>
                            <dd className="text-slate-900">{resolution}</dd>
                        </div>
                    )}
                    {resolutionNotes && (
                        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[12rem_1fr]">
                            <dt className="text-slate-500">Resolution notes</dt>
                            <dd className="whitespace-pre-wrap wrap-break-word text-slate-900">{resolutionNotes}</dd>
                        </div>
                    )}
                </dl>
            )}
        </section>
    );
}