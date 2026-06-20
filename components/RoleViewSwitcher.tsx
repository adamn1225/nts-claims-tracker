"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RoleViewMode = "admin" | "broker" | "manager" | "sales_coach";

const ROLE_VIEW_STORAGE_KEY = "nts:role-view-mode";

export default function RoleViewSwitcher() {
    const supabase = createClient();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<RoleViewMode>("admin");

    useEffect(() => {
        const init = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) return;

                const { data: broker } = await supabase
                    .from("brokers")
                    .select("is_admin")
                    .eq("id", user.id)
                    .single();

                const admin = Boolean(broker?.is_admin);
                setIsAdmin(admin);

                if (!admin) {
                    localStorage.removeItem(ROLE_VIEW_STORAGE_KEY);
                    return;
                }

                const storedMode =
                    (localStorage.getItem(ROLE_VIEW_STORAGE_KEY) as RoleViewMode | null) ||
                    "admin";
                setMode(storedMode);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [supabase]);

    const updateMode = (nextMode: RoleViewMode) => {
        setMode(nextMode);
        localStorage.setItem(ROLE_VIEW_STORAGE_KEY, nextMode);
        window.dispatchEvent(
            new CustomEvent("role-view-mode-changed", {
                detail: { mode: nextMode },
            }),
        );
    };

    if (loading || !isAdmin) {
        return null;
    }

    return (
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <Eye className="h-4 w-4 text-slate-500" />
            <span className="hidden text-xs font-semibold text-slate-600 lg:inline">
                View As
            </span>
            <select
                value={mode}
                onChange={(e) => updateMode(e.target.value as RoleViewMode)}
                className="min-w-27.5 border-none bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
                aria-label="Switch demo role view"
                title="Switch role view for demos"
            >
                <option value="admin">Admin</option>
                <option value="broker">Broker</option>
                <option value="manager">Manager</option>
                <option value="sales_coach">Sales Coach</option>
            </select>
        </div>
    );
}
