"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import IntakeForm from "@/app/intake/claims/IntakeForm";
import { createClient } from "@/lib/supabase/client";

type LookupRow = { id: string; name: string };

type ClaimIntakeModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function ClaimIntakeModal({ isOpen, onClose }: ClaimIntakeModalProps) {
    const [freightTypes, setFreightTypes] = useState<LookupRow[]>([]);
    const [trailerTypes, setTrailerTypes] = useState<LookupRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);
        setError(null);

        const client = createClient();
        Promise.all([
            client
                .from("freight_types")
                .select("id, name")
                .order("position", { ascending: true }),
            client
                .from("trailer_types")
                .select("id, name")
                .order("position", { ascending: true }),
        ])
            .then(([freightRes, trailerRes]) => {
                if (freightRes.error) throw freightRes.error;
                if (trailerRes.error) throw trailerRes.error;

                setFreightTypes((freightRes.data ?? []) as LookupRow[]);
                setTrailerTypes((trailerRes.data ?? []) as LookupRow[]);
            })
            .catch((err) => {
                console.error("Failed to load claim intake lookups", err);
                setError(
                    "Unable to load lookup data for the new claim form. Please refresh the page and try again.",
                );
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Claim" size="xl">
            {isLoading ? (
                <div className="flex min-h-[240px] items-center justify-center px-6 py-10 ">
                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <span>Loading claim intake form…</span>
                    </div>
                </div>
            ) : error ? (
                <div className="space-y-4 px-6 py-10 text-center">
                    <p className="text-sm text-slate-700">{error}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                        Close
                    </button>
                </div>
            ) : (
                <div className="px-4 py-4 sm:px-6">
                    <IntakeForm
                        freightTypes={freightTypes}
                        trailerTypes={trailerTypes}
                        embed={false}
                    />
                </div>
            )}
        </Modal>
    );
}
