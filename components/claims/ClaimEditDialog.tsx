"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import { CLAIM_TYPES } from "@/lib/constants/claim-types";
import type { Database } from "@/lib/database.types";

type ClaimRow = Database["public"]["Tables"]["claims"]["Row"];

export type ClaimEditValues = Pick<
    ClaimRow,
    | "summary"
    | "status_id"
    | "claim_type"
    | "value_bucket"
    | "value_bucket_manual"
    | "tms_order_number"
    | "bol_number"
    | "freight_type_id"
    | "trailer_type_id"
    | "origin_city"
    | "origin_state"
    | "origin_postal_code"
    | "destination_city"
    | "destination_state"
    | "destination_postal_code"
    | "pickup_date"
    | "delivery_date"
    | "incident_date"
    | "damage_claim_amount"
    | "shipment_value"
    | "carrier_pay"
    | "carrier_deductible"
    | "currency"
    | "internal_description"
    | "resolution"
    | "resolution_notes"
>;

type LookupOption = { id: string; name: string };

type FormState = Omit<
    ClaimEditValues,
    | "damage_claim_amount"
    | "shipment_value"
    | "carrier_pay"
    | "carrier_deductible"
> & {
    damage_claim_amount: string;
    shipment_value: string;
    carrier_pay: string;
    carrier_deductible: string;
};

const RESOLUTIONS = [
    { value: "paid_full", label: "Paid in full" },
    { value: "paid_partial", label: "Paid partially" },
    { value: "denied", label: "Denied" },
    { value: "withdrawn", label: "Withdrawn" },
    { value: "recovered", label: "Recovered" },
    { value: "concession", label: "Concession" },
] as const;

const VALUE_BUCKETS = [
    { value: "auto", label: "Automatic (based on claim amount)" },
    { value: "current", label: "Current (<$10K)" },
    { value: "credit_high_value", label: "Credit / High Value" },
    { value: "legal", label: "Legal" },
] as const;

function initialForm(values: ClaimEditValues): FormState {
    return {
        ...values,
        damage_claim_amount: values.damage_claim_amount?.toString() ?? "",
        shipment_value: values.shipment_value?.toString() ?? "",
        carrier_pay: values.carrier_pay?.toString() ?? "",
        carrier_deductible: values.carrier_deductible?.toString() ?? "",
    };
}

function nullableNumber(value: string): number | null {
    return value.trim() === "" ? null : Number(value);
}

export default function ClaimEditDialog({
    claimId,
    claimNumber,
    initialValues,
    statuses,
    freightTypes,
    trailerTypes,
}: {
    claimId: string;
    claimNumber: string;
    initialValues: ClaimEditValues;
    statuses: LookupOption[];
    freightTypes: LookupOption[];
    trailerTypes: LookupOption[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(() => initialForm(initialValues));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [zipLoading, setZipLoading] = useState<"origin" | "destination" | null>(null);

    const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const close = () => {
        if (saving) return;
        setForm(initialForm(initialValues));
        setError(null);
        setOpen(false);
    };

    const lookupZip = async (kind: "origin" | "destination") => {
        const zip = form[`${kind}_postal_code`]?.trim() ?? "";
        if (!/^\d{5}$/.test(zip)) return;
        setZipLoading(kind);
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
            if (!response.ok) return;
            const data = await response.json();
            const place = data?.places?.[0];
            setForm((current) => ({
                ...current,
                [`${kind}_city`]: place?.["place name"] ?? current[`${kind}_city`],
                [`${kind}_state`]:
                    place?.["state abbreviation"] ?? current[`${kind}_state`],
            }));
        } catch {
            // City and state remain manually editable when lookup is unavailable.
        } finally {
            setZipLoading(null);
        }
    };

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const amountFields = [
            form.damage_claim_amount,
            form.shipment_value,
            form.carrier_pay,
            form.carrier_deductible,
        ];
        if (
            amountFields.some((value) => {
                const number = nullableNumber(value);
                return number !== null && (!Number.isFinite(number) || number < 0);
            })
        ) {
            setError("Financial amounts must be zero or greater.");
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/claims/${claimId}/details`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    value_bucket:
                        form.value_bucket_manual === false ? initialValues.value_bucket : form.value_bucket,
                    damage_claim_amount: nullableNumber(form.damage_claim_amount),
                    shipment_value: nullableNumber(form.shipment_value),
                    carrier_pay: nullableNumber(form.carrier_pay),
                    carrier_deductible: nullableNumber(form.carrier_deductible),
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Unable to update claim");
            setOpen(false);
            window.dispatchEvent(
                new CustomEvent("claim-activity-updated", { detail: { claimId } }),
            );
            router.refresh();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : String(saveError));
        } finally {
            setSaving(false);
        }
    };

    const bucketMode = form.value_bucket_manual ? form.value_bucket : "auto";

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 sm:min-h-9"
            >
                <Pencil className="h-4 w-4" />
                Edit claim
            </button>

            <Modal isOpen={open} onClose={close} title={`Edit ${claimNumber}`} size="xl">
                <form onSubmit={submit} className="divide-y divide-slate-200">
                    <EditSection title="Overview">
                        <TextField
                            label="Summary"
                            value={form.summary ?? ""}
                            onChange={(value) => setField("summary", value)}
                            className="sm:col-span-2"
                        />
                        <SelectField
                            label="Status"
                            value={form.status_id}
                            onChange={(value) => setField("status_id", value)}
                        >
                            {statuses.map((status) => (
                                <option key={status.id} value={status.id}>{status.name}</option>
                            ))}
                        </SelectField>
                        <SelectField
                            label="Claim type"
                            value={form.claim_type ?? ""}
                            onChange={(value) =>
                                setField("claim_type", (value || null) as ClaimRow["claim_type"])
                            }
                        >
                            <option value="">Not set</option>
                            {CLAIM_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </SelectField>
                        <SelectField
                            label="Value bucket"
                            value={bucketMode}
                            onChange={(value) => {
                                if (value === "auto") {
                                    setField("value_bucket_manual", false);
                                } else {
                                    setForm((current) => ({
                                        ...current,
                                        value_bucket_manual: true,
                                        value_bucket: value as ClaimRow["value_bucket"],
                                    }));
                                }
                            }}
                        >
                            {VALUE_BUCKETS.map((bucket) => (
                                <option key={bucket.value} value={bucket.value}>{bucket.label}</option>
                            ))}
                        </SelectField>
                    </EditSection>

                    <EditSection title="Shipment">
                        <TextField
                            label="NTS order / load #"
                            value={form.tms_order_number ?? ""}
                            onChange={(value) => setField("tms_order_number", value)}
                        />
                        <TextField
                            label="BOL #"
                            value={form.bol_number ?? ""}
                            onChange={(value) => setField("bol_number", value)}
                        />
                        <SelectField
                            label="Freight type"
                            value={form.freight_type_id ?? ""}
                            onChange={(value) => setField("freight_type_id", value || null)}
                        >
                            <option value="">Not set</option>
                            {freightTypes.map((option) => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                        </SelectField>
                        <SelectField
                            label="Trailer type"
                            value={form.trailer_type_id ?? ""}
                            onChange={(value) => setField("trailer_type_id", value || null)}
                        >
                            <option value="">Not set</option>
                            {trailerTypes.map((option) => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                        </SelectField>
                    </EditSection>

                    <EditSection title="Route and dates">
                        <LocationFields
                            label="Origin"
                            city={form.origin_city ?? ""}
                            state={form.origin_state ?? ""}
                            postalCode={form.origin_postal_code ?? ""}
                            loading={zipLoading === "origin"}
                            onCityChange={(value) => setField("origin_city", value)}
                            onStateChange={(value) => setField("origin_state", value)}
                            onPostalChange={(value) => setField("origin_postal_code", value)}
                            onPostalBlur={() => void lookupZip("origin")}
                        />
                        <LocationFields
                            label="Destination"
                            city={form.destination_city ?? ""}
                            state={form.destination_state ?? ""}
                            postalCode={form.destination_postal_code ?? ""}
                            loading={zipLoading === "destination"}
                            onCityChange={(value) => setField("destination_city", value)}
                            onStateChange={(value) => setField("destination_state", value)}
                            onPostalChange={(value) => setField("destination_postal_code", value)}
                            onPostalBlur={() => void lookupZip("destination")}
                        />
                        <DateField label="Pickup date" value={form.pickup_date ?? ""} onChange={(value) => setField("pickup_date", value || null)} />
                        <DateField label="Delivery date" value={form.delivery_date ?? ""} onChange={(value) => setField("delivery_date", value || null)} />
                        <DateField label="Incident date" value={form.incident_date ?? ""} onChange={(value) => setField("incident_date", value || null)} />
                    </EditSection>

                    <EditSection title="Financials">
                        <MoneyField label="Estimated claim amount" value={form.damage_claim_amount} onChange={(value) => setField("damage_claim_amount", value)} />
                        <MoneyField label="Total shipment value" value={form.shipment_value} onChange={(value) => setField("shipment_value", value)} />
                        <MoneyField label="Carrier pay" value={form.carrier_pay} onChange={(value) => setField("carrier_pay", value)} />
                        <MoneyField label="Carrier deductible" value={form.carrier_deductible} onChange={(value) => setField("carrier_deductible", value)} />
                        <TextField label="Currency" value={form.currency} maxLength={3} onChange={(value) => setField("currency", value.toUpperCase())} />
                    </EditSection>

                    <EditSection title="Description and resolution">
                        <TextareaField
                            label="Internal description"
                            value={form.internal_description ?? ""}
                            onChange={(value) => setField("internal_description", value)}
                            className="sm:col-span-2"
                        />
                        <SelectField
                            label="Resolution"
                            value={form.resolution ?? ""}
                            onChange={(value) => setField("resolution", (value || null) as ClaimRow["resolution"])}
                        >
                            <option value="">Not resolved</option>
                            {RESOLUTIONS.map((resolution) => (
                                <option key={resolution.value} value={resolution.value}>{resolution.label}</option>
                            ))}
                        </SelectField>
                        <TextareaField
                            label="Resolution notes"
                            value={form.resolution_notes ?? ""}
                            onChange={(value) => setField("resolution_notes", value)}
                        />
                    </EditSection>

                    {error && (
                        <div role="alert" className="border-t border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger sm:px-6">
                            {error}
                        </div>
                    )}

                    <div className="sticky bottom-0 flex flex-col-reverse gap-2 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save claim
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <fieldset className="px-4 py-5 sm:px-6">
            <legend className="mb-3 text-sm font-semibold text-slate-900">{title}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
        </fieldset>
    );
}

function TextField({ label, value, onChange, className = "", ...props }: { label: string; value: string; onChange: (value: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
    return (
        <label className={`block ${className}`}>
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
    );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
                {children}
            </select>
        </label>
    );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <TextField label={label} type="date" value={value} onChange={onChange} />;
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <TextField label={label} type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={onChange} />;
}

function TextareaField({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
    return (
        <label className={`block ${className}`}>
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
    );
}

function LocationFields({ label, city, state, postalCode, loading, onCityChange, onStateChange, onPostalChange, onPostalBlur }: { label: string; city: string; state: string; postalCode: string; loading: boolean; onCityChange: (value: string) => void; onStateChange: (value: string) => void; onPostalChange: (value: string) => void; onPostalBlur: () => void }) {
    return (
        <fieldset className="space-y-2 rounded-md border border-slate-200 p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_1fr_5rem]">
                <label className="block">
                    <span className="text-xs font-medium text-slate-600">ZIP {loading && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</span>
                    <input value={postalCode} inputMode="numeric" maxLength={10} onChange={(event) => onPostalChange(event.target.value)} onBlur={onPostalBlur} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <TextField label="City" value={city} onChange={onCityChange} />
                <TextField label="State" value={state} maxLength={2} onChange={(value) => onStateChange(value.toUpperCase())} />
            </div>
        </fieldset>
    );
}