"use client";

// Shared helpers for rendering a printable / emailable summary of an intake
// submission. Used on the wizard's Review step (live preview) and on the
// success page (post-submit receipt via sessionStorage).

import { Printer, Mail } from "lucide-react";

export type LookupRow = { id: string; name: string };

export type IntakeSnapshot = Record<string, string>;

export type SummaryFile = { name: string; type: string };

export type SummaryRow = { label: string; value: string };
export type SummaryGroup = { heading: string; rows: SummaryRow[] };

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  bill_of_lading: "Bill of Lading (BOL)",
  proof_of_delivery: "Proof of Delivery (POD)",
  damage_photo: "Damage photo",
  pickup_photo: "Pickup photo",
  delivery_photo: "Delivery photo",
  repair_estimate: "Repair estimate",
  replacement_invoice: "Replacement invoice",
  witness_statement: "Witness statement",
  other: "Other",
};

export function describeDocumentType(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

function joinNonEmpty(parts: (string | undefined | null)[], sep = ", "): string {
  return parts.filter((p) => p && p.trim().length > 0).join(sep);
}

function formatMoney(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function buildSummaryGroups(
  data: IntakeSnapshot,
  freightTypes: LookupRow[],
  trailerTypes: LookupRow[],
): SummaryGroup[] {
  const get = (k: string) => (data[k] ?? "").trim();
  const lookup = (rows: LookupRow[], id: string) =>
    id ? (rows.find((r) => r.id === id)?.name ?? "") : "";

  const fullName = joinNonEmpty(
    [get("submitter_first_name"), get("submitter_last_name")],
    " ",
  );
  const originLine = joinNonEmpty([
    get("origin_city"),
    get("origin_state"),
    get("origin_postal_code"),
  ]);
  const destLine = joinNonEmpty([
    get("destination_city"),
    get("destination_state"),
    get("destination_postal_code"),
  ]);
  const company = get("submitter_company");

  const groups: SummaryGroup[] = [
    {
      heading: "Your info",
      rows: [
        { label: "Name", value: fullName },
        {
          label: "Company",
          value: company || "Personal shipment (no business entity)",
        },
        { label: "Email", value: get("submitter_email") },
        { label: "Phone", value: get("submitter_phone") },
      ],
    },
    {
      heading: "Shipment",
      rows: [
        { label: "NTS order / load #", value: get("tms_order_number") },
        { label: "BOL #", value: get("bol_number") },
        { label: "Carrier", value: get("carrier_name") },
        { label: "Carrier PRO #", value: get("carrier_pro_number") },
        { label: "Freight type", value: lookup(freightTypes, get("freight_type_id")) },
        { label: "Trailer type", value: lookup(trailerTypes, get("trailer_type_id")) },
        { label: "Commodity", value: get("commodity") },
      ],
    },
    {
      heading: "Route",
      rows: [
        { label: "Origin", value: originLine },
        { label: "Destination", value: destLine },
      ],
    },
    {
      heading: "What happened",
      rows: [
        { label: "Pickup date", value: get("pickup_date") },
        { label: "Delivery date", value: get("delivery_date") },
        { label: "Incident date", value: get("incident_date") },
        { label: "Estimated claim amount", value: formatMoney(get("damage_claim_amount")) },
        { label: "Total shipment value", value: formatMoney(get("shipment_value")) },
        { label: "Description", value: get("damage_description") },
      ],
    },
  ];

  // Drop empty rows and any group that ends up with no data.
  return groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.value.length > 0) }))
    .filter((g) => g.rows.length > 0);
}

// --------------------------- Rendered summary --------------------------

export function ReviewSummary({
  groups,
  reference,
  files,
}: {
  groups: SummaryGroup[];
  reference?: string;
  files?: SummaryFile[];
}) {
  if (groups.length === 0 && (!files || files.length === 0)) {
    return (
      <p className="text-sm text-slate-500">
        No fields filled in yet — use the sidebar to go back and complete the
        form.
      </p>
    );
  }

  return (
    <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      {reference && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Reference
          </div>
          <div className="mt-0.5 font-mono text-base text-slate-900">
            {reference}
          </div>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.heading}>
          <h4 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-900">
            {g.heading}
          </h4>
          <dl className="space-y-1.5">
            {g.rows.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-1 gap-x-4 text-sm sm:grid-cols-[10rem_1fr]"
              >
                <dt className="text-slate-500">{r.label}</dt>
                <dd className="whitespace-pre-wrap break-words text-slate-900">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {files && files.length > 0 && (
        <section>
          <h4 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-900">
            Attachments ({files.length})
          </h4>
          <ul className="space-y-1 text-sm text-slate-900">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-baseline gap-2">
                <span className="break-all">{f.name}</span>
                <span className="text-xs text-slate-500">
                  — {describeDocumentType(f.type)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// --------------------------- Action buttons ----------------------------

export function PrintEmailActions({
  groups,
  files,
  reference,
  recipientEmail,
}: {
  groups: SummaryGroup[];
  files?: SummaryFile[];
  reference?: string;
  recipientEmail?: string;
}) {
  const disabled = groups.length === 0;

  function handlePrint() {
    printSummary(groups, reference, files);
  }

  function handleEmail() {
    const subject = reference
      ? `My NTS claim submission — ${reference}`
      : "My NTS claim submission";
    const body = formatSummaryAsText(groups, reference, files);
    const to = recipientEmail ?? "";
    // mailto length is technically unlimited but most clients cap around 2 KB.
    // Our typical summary is well under that.
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    if (typeof window !== "undefined") window.location.href = url;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handlePrint}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print
      </button>
      <button
        type="button"
        onClick={handleEmail}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Email me a copy
      </button>
    </div>
  );
}

// --------------------------- Formatters --------------------------------

export function formatSummaryAsText(
  groups: SummaryGroup[],
  reference?: string,
  files?: SummaryFile[],
): string {
  const lines: string[] = [];
  lines.push("NTS CLAIM SUBMISSION");
  lines.push("====================");
  if (reference) lines.push(`Reference: ${reference}`);
  lines.push("");

  for (const g of groups) {
    lines.push(g.heading.toUpperCase());
    lines.push("-".repeat(g.heading.length));
    for (const r of g.rows) {
      lines.push(`${r.label}: ${r.value.replace(/\n/g, " ")}`);
    }
    lines.push("");
  }

  if (files && files.length > 0) {
    lines.push("ATTACHMENTS");
    lines.push("-----------");
    for (const f of files) {
      lines.push(`- ${f.name} (${describeDocumentType(f.type)})`);
    }
    lines.push("");
  }

  lines.push(
    "Submitted via Nationwide Transport Services online claim intake.",
  );

  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

export function printSummary(
  groups: SummaryGroup[],
  reference?: string,
  files?: SummaryFile[],
): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "noopener,noreferrer,width=820,height=900");
  if (!w) {
    // Popup blocked — fall back to printing the current page.
    window.print();
    return;
  }

  const rowsHtml = (rows: SummaryRow[]) =>
    rows
      .map(
        (r) => `<tr>
        <td style="padding:5px 14px 5px 0;color:#64748b;white-space:nowrap;vertical-align:top;font-weight:500">${escapeHtml(r.label)}</td>
        <td style="padding:5px 0;color:#0f172a;white-space:pre-wrap;word-break:break-word">${escapeHtml(r.value)}</td>
      </tr>`,
      )
      .join("");

  const groupsHtml = groups
    .map(
      (g) => `
    <section style="margin-top:22px">
      <h2 style="font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.04em">${escapeHtml(g.heading)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:inherit">${rowsHtml(g.rows)}</table>
    </section>`,
    )
    .join("");

  const filesHtml =
    files && files.length > 0
      ? `<section style="margin-top:22px">
      <h2 style="font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.04em">Attachments (${files.length})</h2>
      <ul style="font-size:13px;color:#0f172a;padding-left:20px;margin:0;line-height:1.5">${files
        .map(
          (f) =>
            `<li>${escapeHtml(f.name)} <span style="color:#64748b">— ${escapeHtml(describeDocumentType(f.type))}</span></li>`,
        )
        .join("")}</ul>
    </section>`
      : "";

  const refHtml = reference
    ? `<p style="font-size:13px;color:#64748b;margin:6px 0 0">Reference: <span style="font-family:ui-monospace,'SF Mono',Menlo,monospace;color:#0f172a;font-weight:600">${escapeHtml(reference)}</span></p>`
    : "";

  const titleSuffix = reference ? ` — ${escapeHtml(reference)}` : "";

  w.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>NTS Claim Submission${titleSuffix}</title>
  <style>
    @page { margin: 0.6in; }
    body { margin: 0; padding: 28px; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.4; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <header style="border-bottom:3px solid #E85D04;padding-bottom:12px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#C2410C;text-transform:uppercase">Nationwide Transport Services</div>
    <h1 style="font-size:22px;margin:4px 0 0;color:#0f172a;font-weight:600">Claim submission</h1>
    ${refHtml}
  </header>
  ${groupsHtml}
  ${filesHtml}
  <footer style="margin-top:30px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
    Generated ${escapeHtml(new Date().toLocaleString())} &middot; Keep this for your records.
  </footer>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 100); };<\/script>
</body>
</html>`);
  w.document.close();
}
