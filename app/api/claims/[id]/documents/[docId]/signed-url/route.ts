import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/claims/:id/documents/:docId/signed-url
 *
 * Returns a short-lived signed URL for downloading / previewing the document.
 * Uses the service-role client for the signed-URL grant (RLS on storage is
 * enforced via the caller's session first).
 */
export async function GET(
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

  // RLS on claim_documents already enforces claim visibility.
  const { data: doc, error } = await supabase
    .from("claim_documents")
    .select("storage_bucket, storage_path, filename, mime_type")
    .eq("id", docId)
    .eq("claim_id", claimId)
    .single();

  if (error || !doc) {
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 300);

  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "Sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: signed.signedUrl,
    filename: doc.filename,
    mime_type: doc.mime_type,
    expires_in: 300,
  });
}
