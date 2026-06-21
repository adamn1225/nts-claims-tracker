"use client";

import { useEffect, useState } from "react";
import {
  buildSummaryGroups,
  PrintEmailActions,
  ReviewSummary,
  type IntakeSnapshot,
  type LookupRow,
  type SummaryFile,
  type SummaryGroup,
} from "../ReviewSummary";

type StoredReceipt = {
  reference: string;
  snapshot: IntakeSnapshot;
  files: SummaryFile[];
  freightTypes: LookupRow[];
  trailerTypes: LookupRow[];
};

// Renders the customer's submitted-claim receipt: summary + print + email.
// Reads the snapshot the wizard wrote to sessionStorage on successful submit.
// If sessionStorage is empty (refresh, different tab, opened by recipient
// of a forwarded link, etc.) we just hide the receipt block — the success
// page still shows the reference number + next-steps copy.
export default function IntakeReceipt({ reference }: { reference: string }) {
  const [data, setData] = useState<StoredReceipt | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(`intake-receipt:${reference}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredReceipt;
      if (parsed && parsed.snapshot) setData(parsed);
    } catch {
      // Ignore malformed data.
    }
  }, [reference]);

  if (!data) return null;

  const groups: SummaryGroup[] = buildSummaryGroups(
    data.snapshot,
    data.freightTypes,
    data.trailerTypes,
  );

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Your submission
        </h2>
        <PrintEmailActions
          groups={groups}
          files={data.files}
          reference={data.reference}
          recipientEmail={data.snapshot.submitter_email}
        />
      </div>
      <ReviewSummary
        groups={groups}
        files={data.files}
        reference={data.reference}
      />
      <p className="mt-4 text-xs text-slate-500">
        Tip: print this page or email yourself a copy now — for security this
        receipt is only available in this browser tab.
      </p>
    </section>
  );
}
