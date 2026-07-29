"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

// Kept in sync with the `document_type` enum in the initial claims migration
// + additions from migration 20260729000002.
const DOCUMENT_TYPES = [
  { value: "bill_of_lading", label: "Bill of Lading (BOL)" },
  { value: "proof_of_delivery", label: "Proof of Delivery (POD)" },
  { value: "damage_photo", label: "Damage photo" },
  { value: "pickup_photo", label: "Pickup photo" },
  { value: "delivery_photo", label: "Delivery photo" },
  { value: "video", label: "Video" },
  { value: "repair_estimate", label: "Repair estimate" },
  { value: "replacement_invoice", label: "Replacement invoice" },
  { value: "witness_statement", label: "Witness statement" },
  { value: "presentation_of_loss", label: "Presentation of loss" },
  { value: "ownership_form", label: "Ownership form" },
  { value: "police_report", label: "Police report" },
  { value: "short_pay_notice", label: "Short-pay notice" },
  { value: "non_pay_notice", label: "Non-pay notice" },
  { value: "release", label: "Release" },
  { value: "settlement_agreement", label: "Settlement agreement" },
  { value: "payment_confirmation", label: "Payment confirmation" },
  { value: "insurance_doc", label: "Insurance document" },
  { value: "claim_form", label: "Claim form" },
  { value: "correspondence_attachment", label: "Correspondence attachment" },
  { value: "other", label: "Other" },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

type ClaimDocument = {
  id: string;
  filename: string;
  document_type: DocumentType;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  description: string | null;
  uploaded_at: string;
  ai_extracted_at: string | null;
  ai_extracted_fields: Record<string, unknown> | null;
  ai_requires_review: boolean;
  ai_reviewed_at: string | null;
};

function typeLabel(t: string) {
  return DOCUMENT_TYPES.find((x) => x.value === t)?.label ?? t;
}

function fmtBytes(n: number | null) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(m: string | null) {
  return Boolean(m && m.startsWith("image/"));
}

export interface ClaimDocumentsPanelProps {
  claimId: string;
  canEdit: boolean;
}

/**
 * Full documents workflow for a claim:
 *  - Drag-and-drop or click-to-upload with per-file document_type
 *  - Signed-URL preview / download
 *  - "Extract with AI" per document — GPT-4o-mini vision → JSON, gated by
 *    `ai_requires_review` so the team explicitly approves the values.
 *  - Delete
 */
export default function ClaimDocumentsPanel({
  claimId,
  canEdit,
}: ClaimDocumentsPanelProps) {
  const [docs, setDocs] = useState<ClaimDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ file: File; type: DocumentType }>
  >([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/documents`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load documents");
      setDocs(json.documents ?? []);
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

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    setPendingFiles((prev) => [
      ...prev,
      ...list.map((f) => ({
        file: f,
        type: guessType(f) as DocumentType,
      })),
    ]);
  };

  const guessType = (f: File): DocumentType => {
    const n = f.name.toLowerCase();
    if (n.includes("bol") || n.includes("bill of lading")) return "bill_of_lading";
    if (n.includes("pod") || n.includes("delivery receipt")) return "proof_of_delivery";
    if (n.includes("police")) return "police_report";
    if (n.includes("title") || n.includes("registration") || n.includes("ownership")) return "ownership_form";
    if (n.includes("short-pay") || n.includes("shortpay") || n.includes("short pay")) return "short_pay_notice";
    if (n.includes("non-pay") || n.includes("nonpay")) return "non_pay_notice";
    if (n.includes("damage")) return "damage_photo";
    if (n.includes("pickup")) return "pickup_photo";
    if (n.includes("delivery")) return "delivery_photo";
    if (n.includes("estimate")) return "repair_estimate";
    if (n.includes("invoice")) return "replacement_invoice";
    if (n.includes("witness")) return "witness_statement";
    if (n.includes("release")) return "release";
    if (n.includes("settlement")) return "settlement_agreement";
    if (f.type.startsWith("image/")) return "damage_photo";
    if (f.type.startsWith("video/")) return "video";
    return "other";
  };

  const uploadPending = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      pendingFiles.forEach(({ file, type }) => {
        fd.append("file", file);
        fd.append("document_type", type);
      });
      const res = await fetch(`/api/claims/${claimId}/documents`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      if (json.errors?.length) {
        setError(
          json.errors
            .map(
              (e: { filename: string; error: string }) =>
                `${e.filename}: ${e.error}`,
            )
            .join("\n"),
        );
      }
      setPendingFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async (docId: string) => {
    try {
      const res = await fetch(
        `/api/claims/${claimId}/documents/${docId}/signed-url`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sign failed");
      window.open(json.url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const extract = async (docId: string) => {
    setExtracting(docId);
    setError(null);
    try {
      const res = await fetch(
        `/api/claims/${claimId}/documents/${docId}/extract`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extract failed");
      await load();
      setExpandedId(docId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(null);
    }
  };

  const remove = async (docId: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    try {
      const res = await fetch(
        `/api/claims/${claimId}/documents?doc_id=${encodeURIComponent(docId)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Documents ({docs.length})
          </h2>
          <p className="text-xs text-slate-500">
            BOLs, PODs, photos, estimates &amp; more. Extract structured fields
            from images using AI.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
        )}
      </div>

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed py-4 text-center text-sm ${
            dragOver
              ? "border-primary bg-primary/5 text-primary-text"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:border-primary/40"
          }`}
        >
          <Upload className="h-4 w-4" />
          Drag &amp; drop files here or click to browse
          <span className="text-[11px] text-slate-400">
            Max 25 MB per file · JPG, PNG, PDF, DOCX, XLSX, MP4
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,video/*,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {pendingFiles.length > 0 && (
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            Ready to upload ({pendingFiles.length})
          </p>
          <ul className="space-y-1.5">
            {pendingFiles.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
                <span className="text-slate-500">{fmtBytes(p.file.size)}</span>
                <select
                  value={p.type}
                  onChange={(e) => {
                    const t = e.target.value as DocumentType;
                    setPendingFiles((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, type: t } : row)),
                    );
                  }}
                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-slate-400 hover:text-danger"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingFiles([])}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={uploadPending}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
            >
              {uploading && <Loader2 className="h-3 w-3 animate-spin" />}
              Upload {pendingFiles.length}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 whitespace-pre-line rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : docs.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {docs.map((d) => {
            const isImg = isImageMime(d.mime_type);
            const Icon = isImg ? ImageIcon : FileText;
            const canExtract = canEdit && isImg; // v1: images only
            const expanded = expandedId === d.id;
            return (
              <li key={d.id} className="py-2.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => openDoc(d.id)}
                        className="truncate text-sm font-medium text-accent hover:underline"
                      >
                        {d.filename}
                      </button>
                      <span className="text-xs text-slate-500">
                        {typeLabel(d.document_type)}
                      </span>
                      {d.ai_extracted_at && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            d.ai_requires_review && !d.ai_reviewed_at
                              ? "bg-warning/10 text-warning-text"
                              : "bg-success/10 text-success"
                          }`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {d.ai_requires_review && !d.ai_reviewed_at
                            ? "AI · needs review"
                            : "AI extracted"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {fmtBytes(d.size_bytes)}
                      {" · "}
                      {new Date(d.uploaded_at).toLocaleString()}
                    </p>
                    {d.ai_extracted_fields && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : d.id)
                        }
                        className="mt-1 text-xs text-accent hover:underline"
                      >
                        {expanded
                          ? "Hide extracted fields"
                          : "Show extracted fields"}
                      </button>
                    )}
                    {expanded && d.ai_extracted_fields && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] leading-snug text-slate-700">
                        {JSON.stringify(d.ai_extracted_fields, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openDoc(d.id)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100"
                      aria-label="Open"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    {canExtract && (
                      <button
                        type="button"
                        onClick={() => extract(d.id)}
                        disabled={extracting === d.id}
                        className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {extracting === d.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                        Extract
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        aria-label="Delete document"
                        className="rounded p-1 text-slate-400 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
