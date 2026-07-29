"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { CLAIM_TYPES } from "@/lib/constants/claim-types";
import {
  buildSummaryGroups,
  PrintEmailActions,
  ReviewSummary,
  type IntakeSnapshot,
  type SummaryFile,
  type SummaryGroup,
} from "./ReviewSummary";

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

// ---- Wizard steps -----------------------------------------------------
// Each form section belongs to exactly one step. Steps render in a sidebar
// the user can click freely to jump between. Validation runs per-step on
// "Continue" and across all steps on "Submit".
const STEPS = [
  { id: "contact", label: "Your info", hint: "Contact details" },
  { id: "shipment", label: "Shipment", hint: "Order & carrier" },
  { id: "route", label: "Route", hint: "Origin & destination" },
  { id: "incident", label: "What happened", hint: "Dates & damage" },
  { id: "submit", label: "Documents & review", hint: "Files & submit" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

export default function IntakeForm({
  freightTypes,
  trailerTypes,
  embed,
}: IntakeFormProps) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<StagedFile[]>([]);

  // Wizard state. `maxReached` controls the "completed" check icon in the
  // sidebar so users can see how far they've already navigated.
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  // Snapshot of the user's typed values, captured each time they land on the
  // review step so the Review & submit summary always shows fresh data.
  const [reviewSnapshot, setReviewSnapshot] = useState<IntakeSnapshot>({});
  const [reviewGroups, setReviewGroups] = useState<SummaryGroup[]>([]);

  // Rebuild the review snapshot whenever the user navigates onto the last
  // step. We read directly from the live form (uncontrolled inputs) so we
  // don't have to lift any state up.
  useEffect(() => {
    if (!isLastStep) return;
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const snap: IntakeSnapshot = {};
    for (const [key, value] of fd.entries()) {
      if (typeof value === "string") snap[key] = value;
    }
    setReviewSnapshot(snap);
    setReviewGroups(buildSummaryGroups(snap, freightTypes, trailerTypes));
  }, [isLastStep, freightTypes, trailerTypes, files]);

  const reviewFiles: SummaryFile[] = files.map((f) => ({
    name: f.file.name,
    type: f.documentType,
  }));

  function goToStep(idx: number) {
    const next = Math.max(0, Math.min(STEPS.length - 1, idx));
    setStepIndex(next);
    setMaxReached((m) => Math.max(m, next));
    // Bring the form back into view (useful on mobile where the sidebar
    // pushes content below the fold after a tap).
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document
          .getElementById("intake-step-content")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function goNext() {
    setError(null);
    // Validate only the inputs in the current step. Hidden steps' required
    // inputs are deliberately not enforced here so the user can move around.
    const form = formRef.current;
    if (form) {
      const stepEl = form.querySelector<HTMLElement>(
        `[data-step-id="${currentStep.id}"]`,
      );
      if (stepEl) {
        const fields = stepEl.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input, select, textarea");
        for (const f of Array.from(fields)) {
          if (!f.checkValidity()) {
            f.reportValidity();
            return;
          }
        }
      }
    }
    goToStep(stepIndex + 1);
  }

  function goBack() {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }

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

    const formEl = e.currentTarget;

    // Required fields on hidden steps would silently block native submit
    // (browser can't focus a `display:none` input). Catch that first and
    // jump to the first step containing an invalid field.
    if (!formEl.checkValidity()) {
      const invalid = formEl.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(":invalid");
      if (invalid) {
        const stepEl = invalid.closest<HTMLElement>("[data-step-id]");
        const sid = stepEl?.dataset.stepId as StepId | undefined;
        const idx = sid ? STEPS.findIndex((s) => s.id === sid) : -1;
        if (idx >= 0 && idx !== stepIndex) {
          goToStep(idx);
          // Wait a tick for the section to become visible, then prompt.
          setTimeout(() => invalid.reportValidity(), 120);
        } else {
          invalid.reportValidity();
        }
      }
      return;
    }

    setSubmitting(true);

    try {
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

      // Hand off the submission snapshot to the success page so it can show a
      // printable / emailable receipt without round-tripping to the server.
      try {
        if (typeof window !== "undefined") {
          const fd = new FormData(formEl);
          const snap: IntakeSnapshot = {};
          for (const [k, v] of fd.entries()) {
            if (typeof v === "string") snap[k] = v;
          }
          window.sessionStorage.setItem(
            `intake-receipt:${result.reference}`,
            JSON.stringify({
              reference: result.reference,
              snapshot: snap,
              files: files.map((f) => ({
                name: f.file.name,
                type: f.documentType,
              })),
              freightTypes,
              trailerTypes,
            }),
          );
        }
      } catch {
        // sessionStorage can throw in privacy modes — non-fatal.
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
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:gap-10">
        {/* ---- Sidebar / step navigation ---- */}
        <Stepper
          steps={STEPS}
          stepIndex={stepIndex}
          maxReached={maxReached}
          onSelect={goToStep}
        />

        {/* ---- Step content ---- */}
        <div id="intake-step-content" className="space-y-8">
          {/* Step header */}
          <div className="border-b border-slate-200 pb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-slate-900">
              {currentStep.label}
            </h2>
          </div>

          {/* Step 1 — Your info */}
          <StepContent stepId="contact" current={currentStep.id}>
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
                  placeholder="Jane"
                />
                <Field
                  label="Last name"
                  name="submitter_last_name"
                  required
                  autoComplete="family-name"
                  placeholder="Doe"
                />
              </Grid2>
              <Field
                label="Company / business name"
                name="submitter_company"
                autoComplete="organization"
                placeholder="e.g. Acme Logistics LLC"
                hint="Leave blank for personal shipments — auto transport, RV / camper, household goods, container moves, etc."
              />
              <Grid2>
                <Field
                  label="Email"
                  name="submitter_email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  hint="We'll send your claim acknowledgment and all updates here."
                />
                <Field
                  label="Phone"
                  name="submitter_phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                />
              </Grid2>
            </Section>
          </StepContent>

          {/* Step 2 — Shipment */}
          <StepContent stepId="shipment" current={currentStep.id}>
            <Section
              title="Shipment details"
              description="Provide any reference numbers you have — they help us locate the load in our system. If you're not sure about a field, fill it out to the best of your ability and our team will fill in the rest."
            >
              <Grid2>
                <Field
                  label="NTS order / load number"
                  name="tms_order_number"
                  placeholder="e.g. 1018344"
                  hint="Usually found at the top of your order confirmation, rate confirmation, or invoice."
                />
                <Field
                  label="BOL number"
                  name="bol_number"
                  placeholder="e.g. BOL-1018344"
                  hint="Bill of Lading number — printed on the BOL the driver signed at pickup and delivery."
                />
              </Grid2>
              <Grid2>
                <Field
                  label="Carrier company name"
                  name="carrier_name"
                  placeholder="e.g. Acme Trucking Inc"
                  hint="The trucking company that moved (or was supposed to move) your freight."
                />
                <Field
                  label="Carrier PRO number"
                  name="carrier_pro_number"
                  placeholder="Carrier tracking / PRO #"
                  hint="The carrier's internal tracking number for the shipment. Usually on the BOL or delivery receipt."
                />
              </Grid2>
              <Grid2>
                <Select
                  label="Freight type"
                  name="freight_type_id"
                  hint="Best guess is fine — e.g. tractor, vehicle, container, household goods."
                >
                  <option value="">— Select (optional) —</option>
                  {freightTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Trailer type"
                  name="trailer_type_id"
                  hint="Not sure? Leave blank — our team will identify it from your load record."
                >
                  <option value="">— Not sure / leave blank —</option>
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
                placeholder="e.g. 2022 Kenworth T880, John Deere 9620R tractor, household goods"
                hint="What was being shipped? Year/make/model is helpful for vehicles and equipment."
              />
            </Section>
          </StepContent>

          {/* Step 3 — Route */}
          <StepContent stepId="route" current={currentStep.id}>
            <Section
              title="Origin & destination"
              description="Start with the ZIP code and we'll auto-fill the city and state for you."
            >
              <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
                <legend className="text-sm font-medium text-slate-700">Origin</legend>
                <Grid3>
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
                  <Field label="City" name="origin_city" placeholder="Auto-fills from ZIP" />
                  <Field
                    label="State"
                    name="origin_state"
                    maxLength={2}
                    placeholder="AL"
                  />
                </Grid3>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
                <legend className="text-sm font-medium text-slate-700">
                  Destination
                </legend>
                <Grid3>
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
                  <Field
                    label="City"
                    name="destination_city"
                    placeholder="Auto-fills from ZIP"
                  />
                  <Field
                    label="State"
                    name="destination_state"
                    maxLength={2}
                    placeholder="CA"
                  />
                </Grid3>
              </fieldset>
            </Section>
          </StepContent>

          {/* Step 4 — What happened (dates + damage) */}
          <StepContent stepId="incident" current={currentStep.id}>
            <Section
              title="Key dates"
              description="Approximate dates are fine if you don't remember exactly."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label="Pickup date"
                  name="pickup_date"
                  type="date"
                  hint="When the carrier picked up the freight."
                />
                <Field
                  label="Delivery date"
                  name="delivery_date"
                  type="date"
                  hint="When delivery was attempted or completed."
                />
                <Field
                  label="Date of incident"
                  name="incident_date"
                  type="date"
                  hint="When the damage or loss was discovered."
                />
              </div>
            </Section>

            <Section title="What happened?">
              <Select
                label="What type of claim is this?"
                name="claim_type"
                required
                hint="Helps our team route the claim to the right specialist and improves reporting on cargo-specific patterns."
                defaultValue=""
              >
                <option value="" disabled>
                  Select a claim type…
                </option>
                {CLAIM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Textarea
                label="Describe the damage, loss, or service failure"
                name="damage_description"
                rows={5}
                required
                placeholder="Be as specific as you can — what was damaged, when you noticed it, who was present, any notations on the BOL at delivery, etc."
                hint="The more detail you provide here, the faster our team can investigate. Include any notations made on the BOL or delivery receipt."
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
                  hint="What you're seeking in compensation. A rough estimate is fine — you can update it later with repair invoices."
                />
                <Field
                  label="Total shipment value (USD)"
                  name="shipment_value"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 45000.00"
                  hint="The declared or invoice value of the entire shipment."
                />
              </Grid2>
            </Section>
          </StepContent>

          {/* Step 5 — Documents & review */}
          <StepContent stepId="submit" current={currentStep.id}>
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
                  You can add files now or send them later — our team will email
                  you a secure upload link if anything is missing.
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
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto sm:py-1.5"
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
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-danger hover:bg-danger/5 hover:text-danger sm:w-auto sm:py-1.5"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Review & submit"
              description="Double-check the details below — use the sidebar to jump back and fix anything before you submit. You can also print or email yourself a copy."
            >
              <ReviewSummary
                groups={reviewGroups}
                files={reviewFiles}
              />

              <PrintEmailActions
                groups={reviewGroups}
                files={reviewFiles}
                recipientEmail={reviewSnapshot.submitter_email}
              />

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="acknowledge"
                  required
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>
                  I confirm the information above is accurate and understand
                  that Nationwide Transport Services will contact me within one
                  business day to acknowledge this claim.
                </span>
              </label>
            </Section>
          </StepContent>

          {/* Error banner (visible on any step) */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          {/* Wizard navigation */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
            >
              ← Back
            </button>

            <p className="text-center text-xs text-slate-500">
              Step {stepIndex + 1} of {STEPS.length}
            </p>

            {!isLastStep ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto sm:py-2.5"
              >
                Continue →
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-2.5"
              >
                {submitting ? "Submitting…" : "Submit claim"}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

// ----------------------------- helpers ---------------------------------

// Renders one wizard step. Uses the `hidden` attribute so all inputs stay
// mounted across step changes — FormData picks up the entire form on submit
// regardless of which step is visible, and browser autofill keeps working.
function StepContent({
  stepId,
  current,
  children,
}: {
  stepId: StepId;
  current: StepId;
  children: React.ReactNode;
}) {
  return (
    <div
      data-step-id={stepId}
      hidden={current !== stepId}
      className="space-y-8"
    >
      {children}
    </div>
  );
}

// Sidebar nav. Vertical clickable list on lg+, horizontal scrollable pills
// on smaller screens (also handles iframe-embed mode on partner sites).
function Stepper({
  steps,
  stepIndex,
  maxReached,
  onSelect,
}: {
  steps: readonly { id: StepId; label: string; hint: string }[];
  stepIndex: number;
  maxReached: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <nav aria-label="Form steps" className="lg:sticky lg:top-6 lg:self-start">
      {/* Mobile / embed: horizontal pills. Scrolls within its own box; we
          keep it inside the main padding so the page doesn't gain a
          horizontal scrollbar on phones. */}
      <ol className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
        {steps.map((s, i) => {
          const isCurrent = i === stepIndex;
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={[
                  "min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  isCurrent
                    ? "border-primary bg-primary text-white"
                    : i <= maxReached
                      ? "border-slate-300 bg-white text-slate-700 hover:border-primary"
                      : "border-slate-200 bg-slate-50 text-slate-500",
                ].join(" ")}
              >
                {i + 1}. {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Desktop: vertical list */}
      <ol className="hidden lg:block lg:space-y-1">
        {steps.map((s, i) => {
          const isCurrent = i === stepIndex;
          const isCompleted = !isCurrent && i <= maxReached;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition",
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrent
                      ? "bg-primary text-white"
                      : isCompleted
                        ? "bg-success/10 text-success ring-1 ring-success/30"
                        : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="flex-1">
                  <span
                    className={[
                      "block font-medium",
                      isCurrent ? "text-slate-900" : "text-slate-700",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                  <span className="block text-xs text-slate-500">{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

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

// ZIP first (narrow), then City (wide), then State (narrow).
// This pairs naturally with the auto-fill UX: customer types ZIP → city/state
// populate to the right.
function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr_5rem]">
      {children}
    </div>
  );
}

// Shared hint/help text rendered below an input. Stays visible (no hover
// required) so it works on mobile and is accessible to screen readers.
function FieldHint({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} className="mt-1 block text-xs text-slate-500">
      {text}
    </span>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
};

function Field({ label, name, required, hint, ...rest }: FieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <input
        name={name}
        required={required}
        aria-describedby={hintId}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      />
      {hint && hintId && <FieldHint id={hintId} text={hint} />}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  hint?: string;
};

function Select({
  label,
  name,
  children,
  required,
  hint,
  ...rest
}: SelectProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <select
        name={name}
        required={required}
        aria-describedby={hintId}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      >
        {children}
      </select>
      {hint && hintId && <FieldHint id={hintId} text={hint} />}
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  hint?: string;
};

function Textarea({ label, name, required, hint, ...rest }: TextareaProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <textarea
        name={name}
        required={required}
        aria-describedby={hintId}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      />
      {hint && hintId && <FieldHint id={hintId} text={hint} />}
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
        placeholder="33179"
        autoComplete="postal-code"
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
