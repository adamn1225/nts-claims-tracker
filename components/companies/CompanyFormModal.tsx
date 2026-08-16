"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export const COMPANY_KINDS = [
    "carrier",
    "shipper",
    "factoring",
    "accounts_payable",
    "insurer",
    "broker_agency",
    "other",
] as const;

const KIND_LABELS: Record<string, string> = {
    carrier: "Carrier",
    shipper: "Shipper",
    factoring: "Factoring",
    accounts_payable: "AP",
    insurer: "Insurer",
    broker_agency: "Broker agency",
    other: "Other",
};

export type CompanyFormData = {
    id?: string;
    legal_name: string;
    dba_name: string | null;
    kinds: string[];
    mc_number: string | null;
    dot_number: string | null;
    scac: string | null;
    primary_phone: string | null;
    primary_email: string | null;
    website: string | null;
    street_1: string | null;
    street_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    notes: string | null;
    is_active: boolean;
};

type FormState = {
    legal_name: string;
    dba_name: string;
    kinds: string[];
    mc_number: string;
    dot_number: string;
    scac: string;
    primary_phone: string;
    primary_email: string;
    website: string;
    street_1: string;
    street_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    notes: string;
    is_active: boolean;
};

const EMPTY_FORM: FormState = {
    legal_name: "",
    dba_name: "",
    kinds: [],
    mc_number: "",
    dot_number: "",
    scac: "",
    primary_phone: "",
    primary_email: "",
    website: "",
    street_1: "",
    street_2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    notes: "",
    is_active: true,
};

const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";
const sectionCls = "mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500";

export default function CompanyFormModal({
    isOpen,
    onClose,
    company,
    onSaved,
}: {
    isOpen: boolean;
    onClose: () => void;
    company?: CompanyFormData | null;
    onSaved?: () => void | Promise<void>;
}) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [zipStatus, setZipStatus] = useState<"idle" | "loading" | "error">(
        "idle",
    );

    // Reset the form whenever the modal opens (or the target company changes).
    useEffect(() => {
        if (!isOpen) return;
        if (company) {
            setForm({
                legal_name: company.legal_name ?? "",
                dba_name: company.dba_name ?? "",
                kinds: company.kinds ?? [],
                mc_number: company.mc_number ?? "",
                dot_number: company.dot_number ?? "",
                scac: company.scac ?? "",
                primary_phone: company.primary_phone ?? "",
                primary_email: company.primary_email ?? "",
                website: company.website ?? "",
                street_1: company.street_1 ?? "",
                street_2: company.street_2 ?? "",
                city: company.city ?? "",
                state: company.state ?? "",
                postal_code: company.postal_code ?? "",
                country: company.country ?? "",
                notes: company.notes ?? "",
                is_active: company.is_active ?? true,
            });
        } else {
            // Adding a new company — carriers are the most common entry.
            setForm({ ...EMPTY_FORM, kinds: ["carrier"] });
        }
        setError(null);
        setZipStatus("idle");
    }, [isOpen, company]);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    const toggleKind = (kind: string) =>
        setForm((f) => ({
            ...f,
            kinds: f.kinds.includes(kind)
                ? f.kinds.filter((k) => k !== kind)
                : [...f.kinds, kind],
        }));

    // Auto-fill city/state from a 5-digit US postal code (Zippopotam.us).
    const handlePostalChange = async (value: string) => {
        setForm((f) => ({ ...f, postal_code: value }));
        const digits = value.trim();
        if (!/^\d{5}$/.test(digits)) {
            setZipStatus("idle");
            return;
        }
        setZipStatus("loading");
        try {
            const res = await fetch(`https://api.zippopotam.us/us/${digits}`);
            if (res.ok) {
                const data = await res.json();
                const place = data.places?.[0];
                if (place) {
                    setForm((f) => ({
                        ...f,
                        city: place["place name"] ?? f.city,
                        state: place["state abbreviation"] ?? f.state,
                    }));
                }
                setZipStatus("idle");
            } else {
                setZipStatus("error");
            }
        } catch {
            setZipStatus("error");
        }
    };

    const handleSubmit = async () => {
        if (!form.legal_name.trim()) {
            setError("Legal name is required.");
            return;
        }
        if (form.kinds.length === 0) {
            setError("Select at least one kind.");
            return;
        }

        setSaving(true);
        setError(null);

        const payload = {
            legal_name: form.legal_name.trim(),
            dba_name: form.dba_name.trim() || null,
            kinds: form.kinds,
            mc_number: form.mc_number.trim() || null,
            dot_number: form.dot_number.trim() || null,
            scac: form.scac.trim() || null,
            primary_phone: form.primary_phone.trim() || null,
            primary_email: form.primary_email.trim() || null,
            website: form.website.trim() || null,
            street_1: form.street_1.trim() || null,
            street_2: form.street_2.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            postal_code: form.postal_code.trim() || null,
            country: form.country.trim() || null,
            notes: form.notes.trim() || null,
            is_active: form.is_active,
        };

        try {
            const supabase = createClient();

            if (company?.id) {
                const { error: updateError } = await supabase
                    .from("companies")
                    .update(payload)
                    .eq("id", company.id);
                if (updateError) throw updateError;
            } else {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                const { error: insertError } = await supabase
                    .from("companies")
                    .insert({ ...payload, created_by: user?.id ?? null });
                if (insertError) throw insertError;
            }

            onClose();
            if (onSaved) await onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={company?.id ? "Edit company" : "Add company"}
            size="xl"
        >
            <div className="space-y-6 p-5 sm:p-6">
                {error && (
                    <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                        {error}
                    </div>
                )}

                {/* Identity */}
                <section>
                    <h3 className={sectionCls}>Identity</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelCls}>Legal name *</label>
                            <input
                                className={inputCls}
                                value={form.legal_name}
                                onChange={(e) => set("legal_name", e.target.value)}
                                placeholder="Acme Trucking Inc."
                            />
                        </div>
                        <div>
                            <label className={labelCls}>DBA name</label>
                            <input
                                className={inputCls}
                                value={form.dba_name}
                                onChange={(e) => set("dba_name", e.target.value)}
                                placeholder="Acme Trucking"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Kind(s) *</label>
                            <div className="flex flex-wrap gap-2">
                                {COMPANY_KINDS.map((kind) => {
                                    const active = form.kinds.includes(kind);
                                    return (
                                        <button
                                            type="button"
                                            key={kind}
                                            aria-pressed={active}
                                            onClick={() => toggleKind(kind)}
                                            className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${active
                                                    ? "border-primary bg-primary/10 text-primary-text"
                                                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                                                }`}
                                        >
                                            {KIND_LABELS[kind]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Carrier identifiers */}
                <section>
                    <h3 className={sectionCls}>Carrier identifiers</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className={labelCls}>MC number</label>
                            <input
                                className={inputCls}
                                value={form.mc_number}
                                onChange={(e) => set("mc_number", e.target.value)}
                                placeholder="823456"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>DOT number</label>
                            <input
                                className={inputCls}
                                value={form.dot_number}
                                onChange={(e) => set("dot_number", e.target.value)}
                                placeholder="3095202"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>SCAC</label>
                            <input
                                className={inputCls}
                                value={form.scac}
                                onChange={(e) => set("scac", e.target.value)}
                                placeholder="ACME"
                            />
                        </div>
                    </div>
                </section>

                {/* Contact */}
                <section>
                    <h3 className={sectionCls}>Contact</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className={labelCls}>Phone</label>
                            <input
                                className={inputCls}
                                value={form.primary_phone}
                                onChange={(e) => set("primary_phone", e.target.value)}
                                placeholder="(555) 555-0100"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Email</label>
                            <input
                                type="email"
                                className={inputCls}
                                value={form.primary_email}
                                onChange={(e) => set("primary_email", e.target.value)}
                                placeholder="claims@acme.com"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Website</label>
                            <input
                                className={inputCls}
                                value={form.website}
                                onChange={(e) => set("website", e.target.value)}
                                placeholder="https://acme.com"
                            />
                        </div>
                    </div>
                </section>

                {/* Address */}
                <section>
                    <h3 className={sectionCls}>Address</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Street address</label>
                            <input
                                className={inputCls}
                                value={form.street_1}
                                onChange={(e) => set("street_1", e.target.value)}
                                placeholder="123 Freight Lane"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Address line 2</label>
                            <input
                                className={inputCls}
                                value={form.street_2}
                                onChange={(e) => set("street_2", e.target.value)}
                                placeholder="Suite 200"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>City</label>
                            <input
                                className={inputCls}
                                value={form.city}
                                onChange={(e) => set("city", e.target.value)}
                                placeholder="Charlotte"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>State</label>
                            <input
                                className={inputCls}
                                value={form.state}
                                onChange={(e) => set("state", e.target.value)}
                                placeholder="NC"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Postal code</label>
                            <input
                                className={inputCls}
                                value={form.postal_code}
                                onChange={(e) => handlePostalChange(e.target.value)}
                                placeholder="28202"
                            />
                            {zipStatus === "loading" && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Looking up city/state…
                                </p>
                            )}
                            {zipStatus === "error" && (
                                <p className="mt-1 text-[11px] text-warning-text">
                                    ZIP lookup failed — enter city/state manually.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className={labelCls}>Country</label>
                            <input
                                className={inputCls}
                                value={form.country}
                                onChange={(e) => set("country", e.target.value)}
                                placeholder="US"
                            />
                        </div>
                    </div>
                </section>

                {/* Notes & status */}
                <section>
                    <h3 className={sectionCls}>Notes</h3>
                    <textarea
                        className={inputCls}
                        rows={3}
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        placeholder="Internal notes about this company…"
                    />
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => set("is_active", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                        Active
                    </label>
                </section>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-text disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {company?.id ? "Save changes" : "Add company"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
