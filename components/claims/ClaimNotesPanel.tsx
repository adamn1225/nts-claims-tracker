"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Pin, StickyNote } from "lucide-react";

type NoteAuthor = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
};

type Note = {
    id: string;
    body: string;
    is_pinned: boolean;
    is_ai_generated: boolean;
    created_at: string;
    author: NoteAuthor | null;
};

function authorName(author: NoteAuthor | null): string {
    if (!author) return "Unknown";
    const name = [author.first_name, author.last_name].filter(Boolean).join(" ").trim();
    return name || author.email || "Unknown";
}

function fmt(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? iso
        : d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
}

export interface ClaimNotesPanelProps {
    claimId: string;
    canEdit: boolean;
}

/**
 * Notes only \u2014 kept separate from the action log (status changes, edits,
 * documents, tasks, transactions) so staff can scan context without wading
 * through system events.
 */
export default function ClaimNotesPanel({ claimId, canEdit }: ClaimNotesPanelProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [body, setBody] = useState("");
    const [posting, setPosting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/claims/${claimId}/notes`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Failed to load notes");
            setNotes(json.notes ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [claimId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleAddNote = async () => {
        if (!body.trim()) return;
        setPosting(true);
        setError(null);
        try {
            const res = await fetch(`/api/claims/${claimId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Failed to add note");
            setBody("");
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setPosting(false);
        }
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <StickyNote className="h-4 w-4 text-warning-text" />
                    Notes
                </h2>
                <p className="text-xs text-slate-500">
                    Context and internal commentary \u2014 visible only to claims staff &amp; managers.
                </p>
            </div>

            {canEdit && (
                <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        Add a note
                    </label>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={2}
                        placeholder="Log an internal note..."
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    />
                    <div className="mt-1.5 flex justify-end">
                        <button
                            type="button"
                            onClick={handleAddNote}
                            disabled={posting || !body.trim()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
                        >
                            {posting && <Loader2 className="h-3 w-3 animate-spin" />}
                            Post note
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
            ) : notes.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">No notes yet.</p>
            ) : (
                <ul className="space-y-2">
                    {notes.map((note) => (
                        <li
                            key={note.id}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
                        >
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    {note.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                                    {note.is_ai_generated ? "AI-generated" : authorName(note.author)}
                                </span>
                                <span>{fmt(note.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                {note.body}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
