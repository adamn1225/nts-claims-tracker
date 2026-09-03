"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  DollarSign,
  FileText,
  Loader2,
  Mail,
  MessageSquarePlus,
  Move,
  Pencil,
  StickyNote,
  ListTodo,
} from "lucide-react";

type ActivityKind =
  | "note"
  | "correspondence"
  | "status_change"
  | "document"
  | "task"
  | "transaction"
  | "financial_update"
  | "claim_update";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  occurred_at: string;
  actor_name: string | null;
  title: string;
  body: string | null;
  extra?: Record<string, unknown>;
};

const KIND_META: Record<
  ActivityKind,
  { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }
> = {
  note: {
    icon: StickyNote,
    tone: "bg-warning/10 text-warning-text",
    label: "Note",
  },
  correspondence: {
    icon: Mail,
    tone: "bg-accent/10 text-accent",
    label: "Correspondence",
  },
  status_change: {
    icon: Move,
    tone: "bg-primary/10 text-primary-text",
    label: "Status",
  },
  document: {
    icon: FileText,
    tone: "bg-info/10 text-info-text",
    label: "Document",
  },
  task: {
    icon: ListTodo,
    tone: "bg-slate-200 text-slate-700",
    label: "Task",
  },
  transaction: {
    icon: DollarSign,
    tone: "bg-success/10 text-success",
    label: "Transaction",
  },
  financial_update: {
    icon: DollarSign,
    tone: "bg-accent/10 text-accent",
    label: "Financial edit",
  },
  claim_update: {
    icon: Pencil,
    tone: "bg-primary/10 text-primary-text",
    label: "Claim edit",
  },
};

const KIND_OPTIONS: { value: ActivityKind | "all"; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "note", label: "Notes" },
  { value: "correspondence", label: "Correspondence" },
  { value: "status_change", label: "Status" },
  { value: "document", label: "Documents" },
  { value: "task", label: "Tasks" },
  { value: "transaction", label: "Transactions" },
  { value: "financial_update", label: "Financial edits" },
  { value: "claim_update", label: "Claim edits" },
];

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

export interface ClaimActivityTimelineProps {
  claimId: string;
  canEdit: boolean;
}

/**
 * Unified activity timeline for a claim. Directly addresses L1/L2 in the
 * discovery doc: staff want one feed showing notes, calls, emails, status
 * changes, uploads, tasks, and transactions in chronological order — with
 * an inline quick-note input at the top.
 */
export default function ClaimActivityTimeline({
  claimId,
  canEdit,
}: ClaimActivityTimelineProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const [noteBody, setNoteBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/activity`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load activity");
      setItems(json.activity ?? []);
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

  useEffect(() => {
    const refreshForClaim = (event: Event) => {
      const detail = (event as CustomEvent<{ claimId?: string }>).detail;
      if (detail?.claimId === claimId) void load();
    };
    window.addEventListener("claim-activity-updated", refreshForClaim);
    return () =>
      window.removeEventListener("claim-activity-updated", refreshForClaim);
  }, [claimId, load]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add note");
      setNoteBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Activity timeline
          </h2>
          <p className="text-xs text-slate-500">
            Notes, correspondence, status changes, docs, tasks &amp;
            transactions — all in one feed.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ActivityKind | "all")}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {canEdit && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-2">
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Quick note
          </label>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={2}
            placeholder="Log an internal note — visible only to claims staff & managers."
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={handleAddNote}
              disabled={posting || !noteBody.trim()}
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
      ) : filtered.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">No activity to show.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-slate-200 pl-4">
          {filtered.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              <li key={item.id} className="relative">
                <span
                  className={`absolute -left-6.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white ${meta.tone}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase tracking-wide">
                      {meta.label}
                    </span>
                    <span>{fmt(item.occurred_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {item.title}
                  </p>
                  {item.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {item.body}
                    </p>
                  )}
                  {item.actor_name && (
                    <p className="mt-1 text-xs text-slate-500">
                      by {item.actor_name}
                    </p>
                  )}
                  {item.kind === "correspondence" &&
                    Boolean(item.extra?.requires_human_review) && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning-text">
                        <ArrowRightLeft className="h-2.5 w-2.5" />
                        AI summary — needs review
                      </p>
                    )}
                  {item.kind === "task" &&
                    typeof item.extra?.assigned_to === "string" && (
                      <p className="mt-1 text-xs text-slate-500">
                        Assigned to {String(item.extra.assigned_to)}
                        {item.extra.due_at
                          ? ` · due ${new Date(String(item.extra.due_at)).toLocaleDateString()}`
                          : ""}
                      </p>
                    )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
