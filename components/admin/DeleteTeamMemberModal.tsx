"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type Props = {
    isOpen: boolean;
    teamMember: {
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
    } | null;
    onCloseAction: () => void;
    onConfirmAction: (teamMemberId: string, confirmEmail: string) => Promise<void>;
};

/**
 * Hard-delete confirmation modal. Requires typing the team member's full email
 * exactly to unlock the delete button. Used by TeamMemberTable to permanently
 * remove a team member from both the team_members table and Supabase Auth.
 */
export default function DeleteTeamMemberModal({
    isOpen,
    teamMember,
    onCloseAction,
    onConfirmAction,
}: Props) {
    const [typed, setTyped] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTyped("");
            setError(null);
            setSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen || !teamMember) return null;

    const matches =
        typed.trim().toLowerCase() === teamMember.email.trim().toLowerCase();
    const fullName =
        `${teamMember.first_name ?? ""} ${teamMember.last_name ?? ""}`.trim() ||
        teamMember.email;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!matches || submitting) return;
        setError(null);
        setSubmitting(true);
        try {
            await onConfirmAction(teamMember.id, typed.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete team member");
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">
                                Permanently delete team member
                            </h2>
                            <p className="text-xs text-slate-500">
                                This action cannot be undone.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCloseAction}
                        disabled={submitting}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <p className="font-medium">
                            You are about to delete {fullName}.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
                            <li>
                                Their Supabase Auth login will be deleted &mdash; they can no
                                longer sign in.
                            </li>
                            <li>
                                Their team member profile, preferences, and permissions will be
                                removed.
                            </li>
                            <li>
                                Any customers they own will be moved to{" "}
                                <span className="font-semibold">Limbo (Unassigned)</span> and
                                tagged <code className="rounded bg-red-100 px-1">unassigned</code>{" "}
                                (only when the customer has no existing import source).
                            </li>
                            <li>
                                Any open tasks they own will become unassigned.
                            </li>
                        </ul>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Type the team member&rsquo;s full email to confirm
                        </label>
                        <p className="mb-1.5 text-xs text-slate-500">
                            Expected:{" "}
                            <span className="font-mono font-medium text-slate-700">
                                {teamMember.email}
                            </span>
                        </p>
                        <input
                            type="text"
                            autoFocus
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            placeholder={teamMember.email}
                            autoComplete="off"
                            disabled={submitting}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                        <button
                            type="button"
                            onClick={onCloseAction}
                            disabled={submitting}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!matches || submitting}
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? "Deleting..." : "Permanently delete"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
