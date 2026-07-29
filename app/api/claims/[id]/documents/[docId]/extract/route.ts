import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/claims/:id/documents/:docId/extract
 *
 * Runs OpenAI vision extraction against a document image and stores the
 * extracted structured fields on the row (`ai_extracted_fields`). Sets
 * `ai_requires_review = true` so the UI knows to prompt for human review
 * before treating the values as canonical.
 *
 * Model: gpt-4o-mini (per copilot-instructions.md's AI-first preference for
 * lightweight text/vision tasks). PDFs currently short-circuit to a
 * text-only prompt using the filename + document_type as hints — a
 * proper PDF-to-image pass can be added later.
 */
const EXTRACTION_SCHEMAS: Record<string, string[]> = {
  bill_of_lading: [
    "bol_number",
    "pickup_date",
    "delivery_date",
    "shipper_name",
    "consignee_name",
    "carrier_name",
    "carrier_scac",
    "carrier_mc_number",
    "origin_city",
    "origin_state",
    "destination_city",
    "destination_state",
    "commodity_description",
    "weight_lbs",
    "piece_count",
    "declared_value",
    "damage_notations",
    "signature_present",
  ],
  proof_of_delivery: [
    "bol_reference",
    "delivery_date",
    "signed_by",
    "damage_notations",
    "signature_present",
  ],
  damage_photo: ["damage_description", "estimated_severity"],
  pickup_photo: ["pickup_condition_notes"],
  delivery_photo: ["delivery_condition_notes"],
  repair_estimate: [
    "vendor_name",
    "estimate_date",
    "estimate_total",
    "line_items",
  ],
  replacement_invoice: ["vendor_name", "invoice_date", "invoice_total"],
  presentation_of_loss: [
    "claimed_amount",
    "supporting_documents_referenced",
    "date_of_loss",
    "shipper_of_record",
  ],
};

export async function POST(
  _req: Request,
  {
    params,
  }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id: claimId, docId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: doc, error } = await supabase
    .from("claim_documents")
    .select("id, filename, mime_type, document_type, storage_bucket, storage_path")
    .eq("id", docId)
    .eq("claim_id", claimId)
    .single();

  if (error || !doc) {
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: 404 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 300);

  if (!signed?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to sign document URL" },
      { status: 500 },
    );
  }

  const fields = EXTRACTION_SCHEMAS[doc.document_type] ?? [
    "summary",
    "date",
    "amount",
    "parties",
  ];

  const client = new OpenAI({ apiKey });
  const systemPrompt = `You extract structured fields from a freight-claim document.
Return ONLY valid JSON with the requested keys. Use null for anything you
cannot confidently extract. Money values must be numeric with no currency
symbols or thousands separators. Dates must be ISO 8601 (YYYY-MM-DD).

Document type: ${doc.document_type}
Filename: ${doc.filename}

Requested fields:
${fields.map((f) => `- ${f}`).join("\n")}
`;

  const isImage = (doc.mime_type ?? "").startsWith("image/");

  let extractedRaw = "";
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: isImage
            ? [
                { type: "text", text: "Extract fields from this document." },
                { type: "image_url", image_url: { url: signed.signedUrl } },
              ]
            : `Extract fields from this ${doc.document_type} named "${doc.filename}". (This runtime doesn't have a way to open the file directly — infer from filename hints and return null for anything unknown.)`,
        },
      ],
    });
    extractedRaw = completion.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "AI extraction failed",
      },
      { status: 500 },
    );
  }

  let extracted: Record<string, unknown> = {};
  try {
    extracted = JSON.parse(extractedRaw);
  } catch {
    extracted = { _raw: extractedRaw };
  }

  const { error: updateErr } = await supabase
    .from("claim_documents")
    .update({
      ai_extracted_fields: extracted as Json,
      ai_extracted_at: new Date().toISOString(),
      ai_requires_review: true,
    })
    .eq("id", docId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ extracted, requires_review: true });
}
