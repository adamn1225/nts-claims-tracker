import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "claim-documents";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type DocumentType = Database["public"]["Enums"]["document_type"];

/**
 * GET  /api/claims/:id/documents         — list documents on the claim
 * POST /api/claims/:id/documents         — upload one or more files
 *   multipart form fields:
 *     file            — one file per entry (repeat for multiple uploads)
 *     document_type   — parallel array; defaults to "other"
 *     party_id        — optional; associates a doc with a specific party
 *     description     — optional per-file description
 * DELETE /api/claims/:id/documents?doc_id=... — remove a document
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: claimId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("claim_documents")
    .select(
      `id, filename, document_type, mime_type, size_bytes, storage_path,
       description, party_id, uploaded_at, uploaded_by,
       ai_extracted_at, ai_extracted_fields, ai_requires_review,
       ai_reviewed_at, ai_reviewed_by`,
    )
    .eq("claim_id", claimId)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: claimId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (files.length > 10) {
    return NextResponse.json(
      { error: "Max 10 files per request" },
      { status: 400 },
    );
  }

  const documentTypes = form.getAll("document_type").map(String);
  const partyId = (form.get("party_id") as string | null) || null;
  const description = (form.get("description") as string | null) || null;

  const admin = createAdminClient();
  const created: unknown[] = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_BYTES) {
      errors.push({ filename: file.name, error: "File exceeds 25 MB cap" });
      continue;
    }
    const docType = (documentTypes[i] ?? "other") as DocumentType;
    const storagePath = `claims/${claimId}/${randomUUID()}-${sanitize(file.name)}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const upload = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upload.error) {
      errors.push({ filename: file.name, error: upload.error.message });
      continue;
    }

    const { data: doc, error: insertErr } = await supabase
      .from("claim_documents")
      .insert({
        claim_id: claimId,
        party_id: partyId,
        document_type: docType,
        source: "manual_upload",
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        description,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertErr || !doc) {
      // Roll back the file if metadata insert failed.
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      errors.push({
        filename: file.name,
        error: insertErr?.message ?? "Insert failed",
      });
      continue;
    }
    created.push(doc);
  }

  return NextResponse.json({
    created,
    errors,
    ok: errors.length === 0,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: claimId } = await params;
  const docId = new URL(req.url).searchParams.get("doc_id");
  if (!docId) {
    return NextResponse.json({ error: "doc_id is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: doc, error: fetchErr } = await supabase
    .from("claim_documents")
    .select("id, storage_bucket, storage_path")
    .eq("id", docId)
    .eq("claim_id", claimId)
    .single();
  if (fetchErr || !doc) {
    return NextResponse.json(
      { error: fetchErr?.message ?? "Not found" },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const { error: delErr } = await supabase
    .from("claim_documents")
    .delete()
    .eq("id", doc.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }
  await admin.storage.from(doc.storage_bucket).remove([doc.storage_path]);

  return NextResponse.json({ ok: true });
}

function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100);
}
