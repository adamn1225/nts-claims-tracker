"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type LookupRow = { id: string; name: string };

type IntakeFormProps = {
  freightTypes: LookupRow[];
  trailerTypes: LookupRow[];
  embed: boolean;
};

const DOCUMENT_TYPES = [
  { value: "bill_of_lading", label: "Bill of Lading (BOL)" },
  { value: "proof_of_delivery", label: "Proof of Delivery (POD)" },
  { value: "damage_photo", label: "Damage photo" },
  { value: "pickup_photo", label: "Pickup photo" },
  { value: "delivery_photo", label: "Delivery photo" },
  { value: "repair_estimate", label: "Repair estimate" },
  { value: "replacement_invoice", label: "Replacement invoice" },
  { value: "witness_statement", label: "Witness statement" },
  { value: "other", label: "Other" },
] as const;

type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number]["value"];

const MAX_FILES = 12;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — matches bucket limit

type StagedFile = {
  file: File;
  documentType: DocumentTypeValue;
};

type ApiSuccess = { ok: true; reference: string; submissionId: string };
type ApiError = { ok: false; error: string };

export default function IntakeForm({
  freightTypes,
  trailerTypes,
  embed,
}: IntakeFormProps) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<StagedFile[]>([]);

  // Optional UX: auto-populate city/state from US zip code via zippopotam.us
  const [originZipLoading, setOriginZipLoading] = useState(false);
  const [destZipLoading, setDestZipLoading] = useState(false);

  const lookupZip = useCallback(
    async (
      zip: string,
      setCity: (v: string) => void,
      setState: (v: string) => void,
      setLoading: (v: boolean) => void,
    ) => {
      if (!/^\d{5}$/.test(zip)) return;
      setLoading(true);
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (!res.ok) return;
        const data = await res.json();
        const place = data?.places?.[0];
        if (place?.["place name"]) setCity(place["place name"]);
        if (place?.["state abbreviation"]) setState(place["state abbreviation"]);
      } catch {
        // Silent failure — user can type city/state manually.
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function handleAddFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const incoming = Array.from(fileList);
    const next: StagedFile[] = [...files];

    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files per submission.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `"${file.name}" exceeds the 25 MB per-file limit. Please compress or split it.`,
        );
        continue;
      }
      next.push({ file, documentType: guessDocumentType(file.name) });
    }
    setFiles(next);
  }

  function updateFileType(index: number, documentType: DocumentTypeValue) {
    setFiles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, documentType } : entry)),
    );
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const formEl = e.currentTarget;
      const formData = new FormData(formEl);

      // Strip the multi-file <input>'s files; we send the curated list instead
      // so we can pair each file with its document_type.
      formData.delete("documents");

      files.forEach((entry, idx) => {
        formData.append(`document_file_${idx}`, entry.file, entry.file.name);
        formData.append(`document_type_${idx}`, entry.documentType);
      });
      formData.append("document_count", String(files.length));

      const res = await fetch("/api/intake/claims", {
        method: "POST",
        body: formData,
      });

      const result = (await res.json()) as ApiSuccess | ApiError;

      if (!res.ok || !("ok" in result) || !result.ok) {
        const message =
          (result as ApiError | undefined)?.error ??
          "Something went wrong while submitting your claim. Please try again.";
        setError(message);
        setSubmitting(false);
        return;
      }

      router.push(
        `/intake/claims/success?ref=${encodeURIComponent(result.reference)}${embed ? "&embed=1" : ""}`,
      );
    } catch (err) {
      console.error("Intake submission failed", err);
      setError(
        "We couldn't reach the claims server. Please check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Submitter */}
      <Section
        title="Your contact information"
        description="So our claims team can reach you about this submission."
      >
        <Grid2>
          <Field
            label="First name"
            name="submitter_first_name"
            required
            autoComplete="given-name"
          />
          <Field
            label="Last name"
            name="submitter_last_name"
            required
            autoComplete="family-name"
          />
        </Grid2>
        <Field
          label="Company / business name"
          name="submitter_company"
          autoComplete="organization"
          placeholder="Leave blank for personal shipments (auto / RV / household goods, etc.)"
        />
        <Grid2>
          <Field
            label="Email"
            name="submitter_email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            label="Phone"
            name="submitter_phone"
            type="tel"
            autoComplete="tel"
          />
        </Grid2>
      </Section>

      {/* Shipment identifiers */}
      <Section
        title="Shipment details"
        description="Provide any reference numbers you have — they help us locate the load in our system."
      >
        <Grid2>
          <Field
            label="NTS order / load number"
            name="tms_order_number"
            placeholder="e.g. NTS-123456"
          />
          <Field
            label="BOL number"
            name="bol_number"
            placeholder="Bill of Lading reference"
          />
        </Grid2>
        <Grid2>
          <Field label="Carrier company name" name="carrier_name" />
          <Field label="Carrier PRO number" name="carrier_pro_number" />
        </Grid2>
        <Grid2>
          <Select label="Freight type" name="freight_type_id">
            <option value="">— Select —</option>
            {freightTypes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select label="Trailer type" name="trailer_type_id">
            <option value="">— Select —</option>
            {trailerTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Grid2>
        <Field
          label="Commodity / cargo description"
          name="commodity"
          placeholder="What was being shipped?"
        />
      </Section>

      {/* Origin / Destination */}
      <Section title="Origin & destination">
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="text-sm font-medium text-slate-700">Origin</legend>
          <Grid3>
            <Field label="City" name="origin_city" />
            <Field label="State" name="origin_state" maxLength={2} />
            <ZipField
              label="ZIP"
              name="origin_postal_code"
              loading={originZipLoading}
              onZipResolved={(zip) =>
                lookupZip(
                  zip,
                  (v) => {
                    const el = document.querySelector<HTMLInputElement>(
                      'input[name="origin_city"]',
                    );
                    if (el && !el.value) el.value = v;
                  },
                  (v) => {
                    const el = document.querySelector<HTMLInputElement>(
                      'input[name="origin_state"]',
                    );
                    if (el && !el.value) el.value = v;
                  },
                  setOriginZipLoading,
                )
              }
            />
          </Grid3>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="text-sm font-medium text-slate-700">
            Destination
          </legend>
          <Grid3>
            <Field label="City" name="destination_city" />
            <Field label="State" name="destination_state" maxLength={2} />
            <ZipField
              label="ZIP"
              name="destination_postal_code"
              loading={destZipLoading}
              onZipResolved={(zip) =>
                lookupZip(
                  zip,
                  (v) => {
                    const el = document.querySelector<HTMLInputElement>(
                      'input[name="destination_city"]',
                    );
                    if (el && !el.value) el.value = v;
                  },
                  (v) => {
                    const el = document.querySelector<HTMLInputElement>(
                      'input[name="destination_state"]',
                    );
                    if (el && !el.value) el.value = v;
                  },
                  setDestZipLoading,
                )
              }
            />
          </Grid3>
        </fieldset>
      </Section>

      {/* Dates */}
      <Section title="Key dates">
        <Grid3>
          <Field label="Pickup date" name="pickup_date" type="date" />
          <Field label="Delivery date" name="delivery_date" type="date" />
          <Field label="Date of incident" name="incident_date" type="date" />
        </Grid3>
      </Section>

      {/* Damage / loss */}
      <Section title="What happened?">
        <Textarea
          label="Describe the damage, loss, or service failure"
          name="damage_description"
          rows={5}
          required
          placeholder="Be as specific as you can — what was damaged, when you noticed it, who was present, any notations on the BOL at delivery, etc."
        />
        <Grid2>
          <Field
            label="Estimated claim amount (USD)"
            name="damage_claim_amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="e.g. 7500.00"
          />
          <Field
            label="Total shipment value (USD)"
            name="shipment_value"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="e.g. 45000.00"
          />
        </Grid2>
      </Section>

      {/* Documents */}
      <Section
        title="Supporting documents"
        description="Upload BOL, POD, damage photos, repair estimates, or anything else relevant. PDF / image / Word files up to 25 MB each, 12 files max."
      >
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <input
            type="file"
            id="documents"
            name="documents"
            multiple
            accept="application/pdf,image/*,video/mp4,video/quicktime,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={(e) => handleAddFiles(e.target.files)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90"
          />
          <p className="mt-2 text-xs text-slate-500">
            You can add files now or send them later — our team will email you
            a secure upload link if anything is missing.
          </p>
        </div>

        {files.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {files.map((entry, i) => (
              <li
                key={`${entry.file.name}-${i}`}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {entry.file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(entry.file.size)}
                  </p>
                </div>
                <select
                  value={entry.documentType}
                  onChange={(e) =>
                    updateFileType(i, e.target.value as DocumentTypeValue)
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>
                      {dt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 hover:border-danger hover:bg-danger/5 hover:text-danger"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Consent / submit */}
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="acknowledge"
            required
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span>
            I confirm the information above is accurate and understand that
            Nationwide Transport Services will contact me within one business
            day to acknowledge this claim.
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Submitting…" : "Submit claim"}
        </button>
      </div>
    </form>
  );
}

// ----------------------------- helpers ---------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_6rem_8rem]">
      {children}
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
};

function Field({ label, name, required, ...rest }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <input
        name={name}
        required={required}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      />
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
};

function Select({ label, name, children, required, ...rest }: SelectProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <select
        name={name}
        required={required}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
};

function Textarea({ label, name, required, ...rest }: TextareaProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <textarea
        name={name}
        required={required}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      />
    </label>
  );
}

function ZipField({
  label,
  name,
  loading,
  onZipResolved,
}: {
  label: string;
  name: string;
  loading: boolean;
  onZipResolved: (zip: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {loading && <span className="ml-2 text-xs text-slate-400">looking up…</span>}
      </span>
      <input
        name={name}
        inputMode="numeric"
        maxLength={5}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 5);
          e.target.value = v;
          if (v.length === 5) onZipResolved(v);
        }}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function guessDocumentType(filename: string): DocumentTypeValue {
  const lower = filename.toLowerCase();
  if (lower.includes("bol") || lower.includes("bill")) return "bill_of_lading";
  if (lower.includes("pod") || lower.includes("delivery"))
    return "proof_of_delivery";
  if (lower.includes("repair") || lower.includes("estimate"))
    return "repair_estimate";
  if (lower.includes("invoice")) return "replacement_invoice";
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".heic")
  )
    return "damage_photo";
  return "other";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
