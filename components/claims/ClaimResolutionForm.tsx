"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export const MIN_RESOLUTION_NOTE_LENGTH = 10;

const CLOSE_RESOLUTIONS = [
    { value: "paid_full", label: "Paid in full" },
    { value: "paid_partial", label: "Paid partially" },
    { value: "recovered", label: "Recovered (subrogation)" },
    { value: "concession", label: "Concession" },
    { value: "withdrawn", label: "Withdrawn by shipper" },
] as const;

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
}: {
    mode: "close" | "deny";
    onCancel: () => void;
    onSubmit: (resolution: string, notes: string) => void;
    saving: boolean;
    error: string | null;
}) {
    const [resolution, setResolution] = useState<string>("paid_full");
    const [notes, setNotes] = useState("");

    return (
        <div className="space-y-4 px-6 py-5">
            <p className="text-sm text-slate-600">
                {mode === "deny"
                    ? "This claim will move to Claim Denied and leave the working board. Explain why it was denied \u2014 this is kept on the claim's record."
                    : "This claim will move to Claim Closed and leave the working board. Summarize the outcome \u2014 this is kept on the claim's record."}
            </p>

            {mode === "close" && (
                <label className="block">
                    <span className="text-sm font-medium text-slate-700">Resolution</span>
                    <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {CLOSE_RESOLUTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </label>
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
                    onClick={() => onSubmit(mode === "deny" ? "denied" : resolution, notes)}
                    disabled={saving || notes.trim().length < MIN_RESOLUTION_NOTE_LENGTH}
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
