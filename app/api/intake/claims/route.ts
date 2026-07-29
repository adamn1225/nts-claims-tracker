import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinName } from "@/lib/parse-name";
import type { Json } from "@/lib/database.types";

/**
 * POST /api/intake/claims
 *
 * Public endpoint — the iframe-embedded claim intake form posts here.
 * Uses the service-role Supabase client to bypass RLS on
 * `claim_intake_submissions` (per the documented design in
 * supabase/migrations/20260620000006_seeds_and_rls.sql).
 *
 * Files are uploaded to the private `claim-documents` bucket at
 *   intake/{submission_id}/{uuid}-{filename}
 * and recorded in `attachments` JSONB. They get promoted into
 * `claim_documents` when a triage user converts the submission to a claim.
 */

export const runtime = "nodejs"; // we use Node's crypto for randomUUID
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "claim-documents";
const MAX_FILES = 12;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

type AttachmentMeta = {
  storage_path: string;
  filename: string;
  mime: string;
  size: number;
  document_type: string;
};

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form submission.", 400);
  }

  const submitterFirstName = strField(formData, "submitter_first_name");
  const submitterLastName = strField(formData, "submitter_last_name");
  const submitterEmail = strField(formData, "submitter_email");
  const submitterPhone = strField(formData, "submitter_phone");
  const submitterCompanyRaw = strField(formData, "submitter_company");
  const damageDescription = strField(formData, "damage_description");

  // Computed display name — what we store in the `submitter_name` column
  // and use in correspondence. The structured first/last live in payload.
  const submitterName = joinName(submitterFirstName, submitterLastName);

  // Personal shipments (auto transport, RV / camper, household goods, etc.)
  // often have no business entity. When the submitter leaves the company
  // field blank, fall back to "First Last" so downstream code (the promote
  // flow, party records, reporting) always has a value to work with.
  const isPersonal = submitterCompanyRaw.length === 0;
  const submitterCompany =
    submitterCompanyRaw || submitterName || "Unknown submitter";

  // Minimal server-side validation (the form already enforces required).
  if (!submitterFirstName) return jsonError("Your first name is required.", 400);
  if (!submitterLastName) return jsonError("Your last name is required.", 400);
  if (!submitterEmail || !isEmail(submitterEmail))
    return jsonError("A valid email is required.", 400);
  if (!damageDescription)
    return jsonError(
      "Please describe what happened so we can investigate.",
      400,
    );
  if (formData.get("acknowledge") !== "on")
    return jsonError("Please confirm the acknowledgment checkbox.", 400);

  // Build the structured payload that triage staff will review. Typed as
  // the Supabase `Json` so it satisfies the `claim_intake_submissions.payload`
  // jsonb column without an `as unknown` cast.
  const payload: Json = {
    submitter: {
      first_name: submitterFirstName,
      last_name: submitterLastName,
      full_name: submitterName,
      company: submitterCompany,
      // Distinguishes "Acme Logistics LLC" (business) from "John Smith"
      // (personal shipment). Used in triage badges and value reporting.
      is_personal: isPersonal,
      email: submitterEmail,
      phone: submitterPhone || null,
    },
    shipment: {
      tms_order_number: strField(formData, "tms_order_number") || null,
      bol_number: strField(formData, "bol_number") || null,
      carrier_name: strField(formData, "carrier_name") || null,
      carrier_pro_number: strField(formData, "carrier_pro_number") || null,
      freight_type_id: strField(formData, "freight_type_id") || null,
      trailer_type_id: strField(formData, "trailer_type_id") || null,
      commodity: strField(formData, "commodity") || null,
    },
    origin: {
      city: strField(formData, "origin_city") || null,
      state: (strField(formData, "origin_state") || "").toUpperCase() || null,
      postal_code: strField(formData, "origin_postal_code") || null,
    },
    destination: {
      city: strField(formData, "destination_city") || null,
      state:
        (strField(formData, "destination_state") || "").toUpperCase() || null,
      postal_code: strField(formData, "destination_postal_code") || null,
    },
    dates: {
      pickup_date: strField(formData, "pickup_date") || null,
      delivery_date: strField(formData, "delivery_date") || null,
      incident_date: strField(formData, "incident_date") || null,
    },
    damage: {
      description: damageDescription,
      claim_amount: numField(formData, "damage_claim_amount"),
      shipment_value: numField(formData, "shipment_value"),
      claim_type: strField(formData, "claim_type") || null,
    },
  };

  const supabase = createAdminClient();

  // Reserve the submission id up-front so file paths can include it.
  const submissionId = randomUUID();
  const attachments: AttachmentMeta[] = [];

  // ---- File uploads ----
  const fileCount = Math.min(
    parseInt(strField(formData, "document_count") || "0", 10) || 0,
    MAX_FILES,
  );

  for (let i = 0; i < fileCount; i++) {
    const file = formData.get(`document_file_${i}`);
    const docType = strField(formData, `document_type_${i}`) || "other";

    if (!(file instanceof File) || file.size === 0) continue;

    if (file.size > MAX_FILE_BYTES) {
      return jsonError(
        `"${file.name}" exceeds the 25 MB per-file limit.`,
        413,
      );
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = `intake/${submissionId}/${randomUUID()}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upload.error) {
      console.error("[intake] storage upload failed", {
        submissionId,
        filename: file.name,
        error: upload.error,
      });
      // Best-effort cleanup of any previously uploaded files before bailing.
      if (attachments.length > 0) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(attachments.map((a) => a.storage_path));
      }
      return jsonError(
        "We couldn't upload one of your attachments. Please try again or send the document by email after submitting.",
        500,
      );
    }

    attachments.push({
      storage_path: storagePath,
      filename: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      document_type: docType,
    });
  }

  // ---- Insert the submission row ----
  const submitterIp = extractIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const insert = await supabase
    .from("claim_intake_submissions")
    .insert({
      id: submissionId,
      source: "web_form",
      payload,
      // AttachmentMeta is structurally compatible with Json (all leaves are
      // string | number) but TS can't prove the index signature.
      attachments: attachments as unknown as Json,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      submitter_phone: submitterPhone || null,
      submitter_ip: submitterIp,
      user_agent: userAgent,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    console.error("[intake] insert failed", insert.error);
    // Roll back uploaded files so we don't leave orphans.
    if (attachments.length > 0) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(attachments.map((a) => a.storage_path));
    }
    return jsonError(
      "We couldn't save your submission. Please try again in a moment.",
      500,
    );
  }

  // Short, human-friendly reference shown on the success page.
  const reference = `INT-${submissionId.slice(0, 8).toUpperCase()}`;

  // Fire-and-forget notifications. We don't await these against the user's
  // POST because the form has already succeeded — email failures should
  // never surface to the submitter.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    "https://claims.ntslogistics.com";

  const claimAmountRaw = strField(formData, "claim_amount");
  const notificationSummary = {
    reference,
    submissionId,
    submitterName,
    submitterEmail,
    submitterCompany,
    damageDescription,
    claimAmount: claimAmountRaw ? formatMoneyish(claimAmountRaw) : null,
    attachmentCount: attachments.length,
    appUrl,
  };

  // Dynamically import to keep the module tree lean on cold starts.
  import("@/lib/intake-notifications")
    .then(({ notifyClaimsStaffOfNewIntake, sendIntakeAcknowledgment }) => {
      void notifyClaimsStaffOfNewIntake(notificationSummary);
      void sendIntakeAcknowledgment(notificationSummary);
    })
    .catch((err) => console.error("[intake] notify import failed", err));

  return NextResponse.json({
    ok: true,
    reference,
    submissionId,
  });
}

// ----------------------------- helpers ---------------------------------

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function strField(fd: FormData, name: string): string {
  const v = fd.get(name);
  if (typeof v !== "string") return "";
  return v.trim();
}

function numField(fd: FormData, name: string): number | null {
  const v = strField(fd, name);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
}

function extractIp(request: Request): string | null {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function formatMoneyish(raw: string): string {
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return raw;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}
