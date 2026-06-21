"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { submissionId: string };

type ApiResponse =
  | { ok: true; claimId?: string; claimNumber?: string }
  | { ok: false; error: string };

export default function TriageActions({ submissionId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "promote" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  async function handlePromote() {
    if (busy) return;
    if (
      !window.confirm(
        "Promote this submission into a claim? A new claim will appear in the Inbox column of the kanban.",
      )
    )
      return;

    setBusy("promote");
    setError(null);
    try {
      const res = await fetch(`/api/admin/intake/${submissionId}/promote`, {
        method: "POST",
      });
      const result = (await res.json()) as ApiResponse;
      if (!res.ok || !result.ok) {
        setError(("error" in result && result.error) || "Promotion failed.");
        setBusy(null);
        return;
      }
      // Navigate to the new claim (the kanban will reflect it on next load).
      if (result.claimId) {
        router.push(`/dashboard/claims/${result.claimId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Try again.");
      setBusy(null);
    }
  }

  async function handleReject() {
    if (busy) return;
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/intake/${submissionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote.trim() || undefined }),
      });
      const result = (await res.json()) as ApiResponse;
      if (!res.ok || !result.ok) {
        setError(("error" in result && result.error) || "Rejection failed.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Network error. Try again.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handlePromote}
        disabled={busy !== null}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "promote" ? "Promoting…" : "Promote to claim"}
      </button>

      {!showReject ? (
        <button
          type="button"
          onClick={() => setShowReject(true)}
          disabled={busy !== null}
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reject submission…
        </button>
      ) : (
        <div className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3">
          <label className="block text-xs font-medium text-slate-700">
            Reason for rejection (optional, internal only)
          </label>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            className="block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/30"
            placeholder="e.g. Duplicate of INT-ABCD1234; spam; submitted in error."
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={busy !== null}
              className="flex-1 rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60"
            >
              {busy === "reject" ? "Rejecting…" : "Confirm reject"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReject(false);
                setRejectNote("");
              }}
              disabled={busy !== null}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
