import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinName, resolveName } from "@/lib/parse-name";
import type { Database } from "@/lib/database.types";

/**
 * POST /api/admin/intake/[id]/promote
 *
 * Promotes a `claim_intake_submissions` row into a real `claims` row.
 * - Creates (or reuses) company rows for the submitter (shipper) and carrier
 *   based on free-text names from the public form.
 * - Creates `claim_parties` links for both.
 * - Copies the submission's `attachments` JSONB into `claim_documents` rows
 *   (storage paths stay the same — files don't move).
 * - Marks the submission as `promoted` and back-links `promoted_claim_id`.
 *
 * Auth: claims_staff, manager, or admin.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentTypeEnum = Database["public"]["Enums"]["document_type"];
type ClaimPartyRole = Database["public"]["Enums"]["claim_party_role"];

type SubmissionPayload = {
  submitter?: {
    // Newer submissions store these separately. Older ones may have only `name`.
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    name?: string | null;
    company?: string | null;
    // True when the submitter left the company field blank — typical for
    // personal shipments (auto transport, RV / camper, household goods).
    // The intake API fills `company` with "First Last" in that case.
    is_personal?: boolean | null;
    email?: string | null;
    phone?: string | null;
  };
  shipment?: {
    tms_order_number?: string | null;
    bol_number?: string | null;
    carrier_name?: string | null;
    carrier_pro_number?: string | null;
    freight_type_id?: string | null;
    trailer_type_id?: string | null;
    commodity?: string | null;
  };
  origin?: { city?: string | null; state?: string | null; postal_code?: string | null };
  destination?: { city?: string | null; state?: string | null; postal_code?: string | null };
  dates?: {
    pickup_date?: string | null;
    delivery_date?: string | null;
    incident_date?: string | null;
  };
  damage?: {
    description?: string | null;
    claim_amount?: number | null;
    shipment_value?: number | null;
  };
};

type Attachment = {
  storage_path: string;
  filename: string;
  mime?: string;
  size?: number;
  document_type?: string;
};

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: submissionId } = await ctx.params;

  // ---- Auth ----
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonError("Not authenticated.", 401);

  const { data: profile } = await userClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (
    profile?.is_active === false ||
    !role ||
    !["admin", "manager", "claims_staff"].includes(role)
  ) {
    return jsonError("You don't have permission to promote submissions.", 403);
  }

  // ---- Promote via service-role (so we can insert claim_parties / docs without RLS friction) ----
  const admin = createAdminClient();

  const { data: submission, error: subErr } = await admin
    .from("claim_intake_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (subErr || !submission) {
    return jsonError("Submission not found.", 404);
  }

  if (submission.status !== "pending_review") {
    return jsonError(
      `This submission is already marked "${submission.status}".`,
      409,
    );
  }

  const payload = (submission.payload ?? {}) as SubmissionPayload;
  const attachments = (submission.attachments ?? []) as Attachment[];

  // ---- Resolve Inbox status ----
  const { data: inboxStatus, error: statusErr } = await admin
    .from("claim_statuses")
    .select("id")
    .eq("is_inbox", true)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (statusErr || !inboxStatus) {
    return jsonError("Inbox claim status is not configured.", 500);
  }

  // ---- Resolve / create companies ----
  const isPersonalShipper = payload.submitter?.is_personal === true;
  const shipperCompanyId = await findOrCreateCompany(admin, {
    legalName: payload.submitter?.company ?? null,
    kind: "shipper",
    city: payload.origin?.city ?? null,
    state: payload.origin?.state ?? null,
    postalCode: payload.origin?.postal_code ?? null,
    email: payload.submitter?.email ?? null,
    phone: payload.submitter?.phone ?? null,
    notes: isPersonalShipper
      ? "Personal shipment (individual customer — no business entity)"
      : null,
    createdBy: user.id,
  });

  const carrierCompanyId = await findOrCreateCompany(admin, {
    legalName: payload.shipment?.carrier_name ?? null,
    kind: "carrier",
    city: null,
    state: null,
    postalCode: null,
    email: null,
    phone: null,
    notes: null,
    createdBy: user.id,
  });

  // ---- Insert the claim ----
  const summary = buildSummary(payload);
  const internalDescription = payload.damage?.description ?? null;

  const { data: claim, error: claimErr } = await admin
    .from("claims")
    .insert({
      intake_source: "web_form",
      intake_submission_id: submissionId,
      status_id: inboxStatus.id,
      damage_claim_amount: payload.damage?.claim_amount ?? null,
      shipment_value: payload.damage?.shipment_value ?? null,
      freight_type_id: payload.shipment?.freight_type_id || null,
      trailer_type_id: payload.shipment?.trailer_type_id || null,
      origin_city: payload.origin?.city ?? null,
      origin_state: payload.origin?.state ?? null,
      origin_postal_code: payload.origin?.postal_code ?? null,
      destination_city: payload.destination?.city ?? null,
      destination_state: payload.destination?.state ?? null,
      destination_postal_code: payload.destination?.postal_code ?? null,
      incident_date: payload.dates?.incident_date || null,
      pickup_date: payload.dates?.pickup_date || null,
      delivery_date: payload.dates?.delivery_date || null,
      tms_order_number: payload.shipment?.tms_order_number ?? null,
      bol_number: payload.shipment?.bol_number ?? null,
      summary,
      internal_description: internalDescription,
      owner_id: user.id,
      created_by: user.id,
    })
    .select("id, claim_number")
    .single();

  if (claimErr || !claim) {
    console.error("[promote] claim insert failed", claimErr);
    return jsonError(
      "We couldn't create the claim. Check server logs for details.",
      500,
    );
  }

  // ---- Insert claim_parties ----
  const partyInserts: Array<{
    claim_id: string;
    company_id: string;
    role: ClaimPartyRole;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  }> = [];

  if (shipperCompanyId) {
    // Reconcile any submission shape: explicit first/last, full only, or both.
    const submitterName = resolveName({
      first: payload.submitter?.first_name,
      last: payload.submitter?.last_name,
      full: payload.submitter?.full_name ?? payload.submitter?.name ?? null,
    });
    partyInserts.push({
      claim_id: claim.id,
      company_id: shipperCompanyId,
      role: "shipper",
      contact_name:
        submitterName.full_name ??
        joinName(
          payload.submitter?.first_name,
          payload.submitter?.last_name,
        ),
      contact_email: payload.submitter?.email ?? null,
      contact_phone: payload.submitter?.phone ?? null,
    });
  }
  if (carrierCompanyId) {
    partyInserts.push({
      claim_id: claim.id,
      company_id: carrierCompanyId,
      role: "carrier",
    });
  }

  if (partyInserts.length > 0) {
    const { error: partyErr } = await admin
      .from("claim_parties")
      .insert(partyInserts);
    if (partyErr) {
      console.error("[promote] party insert failed (non-fatal)", partyErr);
      // Continue — the claim row is the source of truth; parties can be re-added by hand.
    }
  }

  // ---- Copy attachments into claim_documents ----
  if (attachments.length > 0) {
    const docInserts = attachments.map((att) => ({
      claim_id: claim.id,
      document_type: normalizeDocType(att.document_type),
      source: "intake_form" as Database["public"]["Enums"]["document_source"],
      storage_bucket: "claim-documents",
      storage_path: att.storage_path,
      filename: att.filename,
      mime_type: att.mime ?? null,
      size_bytes: att.size ?? null,
      uploaded_by: user.id,
    }));

    const { error: docErr } = await admin
      .from("claim_documents")
      .insert(docInserts);
    if (docErr) {
      console.error("[promote] document copy failed (non-fatal)", docErr);
      // Continue — files are still in storage and the attachment metadata
      // lives on the submission row for recovery.
    }
  }

  // ---- Mark submission promoted ----
  const { error: updateErr } = await admin
    .from("claim_intake_submissions")
    .update({
      status: "promoted",
      promoted_claim_id: claim.id,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (updateErr) {
    console.error("[promote] submission status update failed", updateErr);
    // Non-fatal — claim exists; staff can re-mark manually.
  }

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    claimNumber: claim.claim_number,
  });
}

// ----------------------------- helpers ---------------------------------

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function buildSummary(p: SubmissionPayload): string | null {
  const parts: string[] = [];
  if (p.shipment?.bol_number) parts.push(`BOL ${p.shipment.bol_number}`);
  if (p.shipment?.tms_order_number)
    parts.push(`Order ${p.shipment.tms_order_number}`);
  if (p.submitter?.company) parts.push(`from ${p.submitter.company}`);
  if (p.shipment?.carrier_name) parts.push(`via ${p.shipment.carrier_name}`);
  if (parts.length === 0) return p.damage?.description?.slice(0, 200) ?? null;
  return parts.join(" — ");
}

function normalizeDocType(value: string | undefined): DocumentTypeEnum {
  const allowed: DocumentTypeEnum[] = [
    "bill_of_lading",
    "proof_of_delivery",
    "damage_photo",
    "pickup_photo",
    "delivery_photo",
    "video",
    "repair_estimate",
    "replacement_invoice",
    "witness_statement",
    "presentation_of_loss",
    "release",
    "settlement_agreement",
    "payment_confirmation",
    "insurance_doc",
    "claim_form",
    "correspondence_attachment",
    "other",
  ];
  return (allowed as string[]).includes(value ?? "")
    ? (value as DocumentTypeEnum)
    : "other";
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function findOrCreateCompany(
  admin: AdminClient,
  args: {
    legalName: string | null;
    kind: Database["public"]["Enums"]["company_kind"];
    city: string | null;
    state: string | null;
    postalCode: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    createdBy: string;
  },
): Promise<string | null> {
  const name = args.legalName?.trim();
  if (!name) return null;

  // Cheap exact-match dedup. Fuzzy matching can come later.
  const { data: existing } = await admin
    .from("companies")
    .select("id, kinds")
    .ilike("legal_name", name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    // Add the kind if missing.
    if (!existing.kinds?.includes(args.kind)) {
      const nextKinds = Array.from(new Set([...(existing.kinds ?? []), args.kind]));
      await admin
        .from("companies")
        .update({ kinds: nextKinds })
        .eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await admin
    .from("companies")
    .insert({
      legal_name: name,
      kinds: [args.kind],
      city: args.city,
      state: args.state,
      postal_code: args.postalCode,
      primary_email: args.email,
      primary_phone: args.phone,
      notes: args.notes,
      created_by: args.createdBy,
      external_source: "intake_form",
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[promote] company create failed", error);
    return null;
  }
  return created.id;
}
