"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Pin } from "lucide-react";

type Note = {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  author: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

export default function CompanyNotesPanel({ companyId }: { companyId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`, {
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
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Add failed");
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
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        Internal notes
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Carrier performance, do-not-use reasons, key relationship contacts —
        anything the team needs to see next time this company appears on a
        claim.
      </p>

      <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add note
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        />
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={posting || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
          >
            {posting && <Loader2 className="h-3 w-3 animate-spin" />}
            Post
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-slate-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {notes.map((n) => {
            const name =
              [n.author?.first_name, n.author?.last_name]
                .filter(Boolean)
                .join(" ") ||
              n.author?.email ||
              "—";
            return (
              <li
                key={n.id}
                className="rounded-md border border-slate-200 p-2 text-slate-800"
              >
                {n.is_pinned && (
                  <span className="mr-1 inline-flex items-center gap-0.5 text-warning-text">
                    <Pin className="h-3 w-3" />
                  </span>
                )}
                <span className="whitespace-pre-wrap">{n.body}</span>
                <p className="mt-1 text-[11px] text-slate-500">
                  {name} · {new Date(n.created_at).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
