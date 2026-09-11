"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldX } from "lucide-react";
import Modal from "@/components/Modal";
import ClaimResolutionForm, {
    MIN_RESOLUTION_NOTE_LENGTH,
} from "@/components/claims/ClaimResolutionForm";

/**
 * Deliberate close/deny actions for a claim, each gated behind a required
 * outcome note. Keeping this off the kanban board's drag-and-drop is what
 * lets the note be mandatory without an awkward post-drop prompt.
 */
export default function ClaimResolutionActions({
    claimId,
    canEdit,
    isAlreadyResolved,
}: {
    claimId: string;
    canEdit: boolean;
    isAlreadyResolved: boolean;
}) {
    const router = useRouter();
    const [mode, setMode] = useState<"close" | "deny" | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!canEdit || isAlreadyResolved) return null;

    const close = () => {
        if (saving) return;
        setMode(null);
        setError(null);
    };

    const submit = async (resolution: string, notes: string) => {
        if (notes.trim().length < MIN_RESOLUTION_NOTE_LENGTH) {
            setError(`Please add a brief explanation (at least ${MIN_RESOLUTION_NOTE_LENGTH} characters).`);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/claims/${claimId}/resolve`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: mode,
                    resolution,
                    resolution_notes: notes,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Unable to update claim");
            window.dispatchEvent(
                new CustomEvent("claim-activity-updated", { detail: { claimId } }),
            );
            close();
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setMode("close")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10"
                >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Close claim
                </button>
                <button
                    type="button"
                    onClick={() => setMode("deny")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/5 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                >
                    <ShieldX className="h-3.5 w-3.5" />
                    Deny claim
                </button>
            </div>

            <Modal
                isOpen={mode !== null}
                onClose={close}
                title={mode === "deny" ? "Deny claim" : "Close claim"}
            >
                {mode && (
                    <ClaimResolutionForm
                        mode={mode}
                        onCancel={close}
                        onSubmit={submit}
                        saving={saving}
                        error={error}
                    />
                )}
            </Modal>
        </>
    );
}
