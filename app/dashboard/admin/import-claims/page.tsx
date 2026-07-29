"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

/**
 * FreightClaims → NTS Claims Tracker CSV import wizard.
 *
 * Flow:
 *   1. Paste or upload CSV (must include header row)
 *   2. Map columns to canonical field names (auto-detected from common
 *      FreightClaims exports)
 *   3. Dry run → preview
 *   4. Commit → creates claims with `intake_source='freightclaims_legacy'`
 *
 * v0 keeps the mapper simple: only fields the discovery meeting explicitly
 * called out. Expand as more columns are needed after the follow-up meeting.
 */

type CanonicalField =
  | "ignore"
  | "claim_number"
  | "customer_name"
  | "carrier_name"
  | "amount"
  | "bol_number"
  | "tms_order_number"
  | "opened_at"
  | "filing_status";

const CANONICAL_LABELS: Record<CanonicalField, string> = {
  ignore: "— ignore —",
  claim_number: "Claim # (legacy)",
  customer_name: "Customer / Shipper name",
  carrier_name: "Carrier name",
  amount: "Claim amount (USD)",
  bol_number: "BOL #",
  tms_order_number: "Load / Order #",
  opened_at: "Opened date",
  filing_status: "Filing status",
};

const HEADER_HEURISTICS: Array<{ regex: RegExp; to: CanonicalField }> = [
  { regex: /primary\s*identifier|claim\s*#|claim\s*number/i, to: "claim_number" },
  { regex: /^customer$|shipper|business|customer\s*name/i, to: "customer_name" },
  { regex: /carrier|capacity/i, to: "carrier_name" },
  { regex: /amount|total|filed/i, to: "amount" },
  { regex: /^bol$|bill\s*of\s*lading/i, to: "bol_number" },
  { regex: /order|load|pro/i, to: "tms_order_number" },
  { regex: /created|opened|open\s*date/i, to: "opened_at" },
  { regex: /filing|status/i, to: "filing_status" },
];

type PreviewRow = {
  index: number;
  claim_number: string | null;
  shipper: string | null;
  carrier: string | null;
  amount: number | null;
  action: string;
  error?: string;
};

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return { headers: [], rows: [] };

  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"' && cleaned[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        lines.push(cur);
        cur = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    lines.push(cur);
  }

  const headers = lines[0] ?? [];
  const rows = lines.slice(1).filter((r) => r.some((c) => c.trim().length));
  return { headers, rows };
}

export default function ImportClaimsPage() {
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, CanonicalField>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [committed, setCommitted] = useState<{
    imported: number;
    errored: number;
    results: PreviewRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = () => {
    setError(null);
    setPreview(null);
    setCommitted(null);
    const { headers, rows } = parseCsv(csvText);
    setHeaders(headers);
    setRows(rows);
    const guess: Record<number, CanonicalField> = {};
    headers.forEach((h, i) => {
      const found = HEADER_HEURISTICS.find((r) => r.regex.test(h));
      guess[i] = found?.to ?? "ignore";
    });
    setMapping(guess);
  };

  const buildRowObjects = () => {
    const objs: Record<string, unknown>[] = [];
    for (const raw of rows) {
      const o: Record<string, unknown> = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field === "ignore") return;
        const val = raw[Number(colIdx)]?.trim();
        if (val) o[field] = val;
      });
      objs.push(o);
    }
    return objs;
  };

  const call = async (dryRun: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, rows: buildRowObjects() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      if (dryRun) {
        setPreview(json.preview);
        setCommitted(null);
      } else {
        setCommitted({
          imported: json.imported,
          errored: json.errored,
          results: json.results,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs text-slate-500">
          <Link href="/dashboard/admin" className="hover:text-primary">
            ← Admin
          </Link>
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          Import claims from FreightClaims
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste a CSV export or upload a file. Rows land as claims with{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            intake_source = freightclaims_legacy
          </code>{" "}
          in the inbox column. Companies (shipper / carrier) are auto-deduped by
          name.
        </p>
      </div>

      {/* Step 1 — paste */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          1. Paste CSV (or upload)
        </h2>
        <div className="mb-2 flex items-center gap-2">
          <label className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Upload className="h-3.5 w-3.5" />
            Upload .csv
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          <a
            href="data:text/csv;charset=utf-8,claim_number,customer_name,carrier_name,amount,bol_number,opened_at,filing_status%0A1043460,WESTERN%20TRUCKS,TOMACHI%20LLC,1000,BOL-001,2026-06-18,filed_not_acknowledged"
            download="freightclaims-import-template.csv"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Template
          </a>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder="claim_number,customer_name,carrier_name,amount,bol_number,opened_at&#10;1043460,WESTERN TRUCKS,TOMACHI LLC,1000.00,BOL-001,2026-06-18"
          className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={handleParse}
            disabled={!csvText.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
          >
            Parse CSV
          </button>
        </div>
      </section>

      {/* Step 2 — mapping */}
      {headers.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            2. Map columns
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            {rows.length} data rows detected. Verify each column maps to the
            correct field.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">Column</th>
                  <th className="py-1 pr-2 font-medium">Sample</th>
                  <th className="py-1 pr-2 font-medium">Maps to</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-mono">{h}</td>
                    <td className="py-1 pr-2 text-slate-500">
                      {rows[0]?.[i] ?? ""}
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={mapping[i] ?? "ignore"}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [i]: e.target.value as CanonicalField,
                          }))
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        {(
                          Object.entries(CANONICAL_LABELS) as Array<
                            [CanonicalField, string]
                          >
                        ).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => call(true)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Dry run
            </button>
            <button
              type="button"
              onClick={() => call(false)}
              disabled={busy || !preview}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Commit import
            </button>
          </div>
          {!preview && (
            <p className="mt-2 text-right text-[11px] text-slate-500">
              Run a dry run before you can commit.
            </p>
          )}
        </section>
      )}

      {/* Errors */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && !committed && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            3. Preview ({preview.length} rows)
          </h2>
          <ResultTable rows={preview} />
        </section>
      )}

      {/* Committed */}
      {committed && (
        <section className="rounded-xl border border-success/30 bg-success/5 p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Import complete — {committed.imported} created,{" "}
            {committed.errored} errored
          </h2>
          <ResultTable rows={committed.results} />
        </section>
      )}
    </main>
  );
}

function ResultTable({ rows }: { rows: PreviewRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-2 font-medium">#</th>
            <th className="py-1 pr-2 font-medium">Claim #</th>
            <th className="py-1 pr-2 font-medium">Shipper</th>
            <th className="py-1 pr-2 font-medium">Carrier</th>
            <th className="py-1 pr-2 font-medium">Amount</th>
            <th className="py-1 pr-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="border-t border-slate-100">
              <td className="py-1 pr-2 text-slate-400">{r.index + 1}</td>
              <td className="py-1 pr-2 font-mono">{r.claim_number ?? "—"}</td>
              <td className="py-1 pr-2">{r.shipper ?? "—"}</td>
              <td className="py-1 pr-2">{r.carrier ?? "—"}</td>
              <td className="py-1 pr-2">
                {r.amount != null ? `$${r.amount.toLocaleString()}` : "—"}
              </td>
              <td className="py-1 pr-2">
                {r.action === "error" ? (
                  <span className="text-danger">error: {r.error}</span>
                ) : r.action === "created" ? (
                  <span className="text-success">{r.action}</span>
                ) : (
                  <span className="text-slate-500">{r.action}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
