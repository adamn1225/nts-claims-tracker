"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import CompanyFormModal, { type CompanyFormData } from "./CompanyFormModal";

export default function EditCompanyButton({
    company,
}: {
    company: CompanyFormData;
}) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
                <Pencil className="h-4 w-4" />
                Edit
            </button>
            <CompanyFormModal
                isOpen={open}
                onClose={() => setOpen(false)}
                company={company}
                onSaved={() => router.refresh()}
            />
        </>
    );
}
