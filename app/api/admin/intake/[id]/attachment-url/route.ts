import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/intake/[id]/attachment-url?path=<storage_path>
 *
 * Returns a short-lived signed URL for a file in the `claim-documents`
 * bucket that belongs to the given intake submission. Used by the triage UI
 * to let staff preview attachments before promoting.
 *
 * Auth: claims_staff, manager, or admin.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: submissionId } = await ctx.params;
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) return jsonError("Missing path parameter.", 400);

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonError("Not authenticated.", 401);

  const { data: profile } = await userClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (
    profile?.is_active === false ||
    !role ||
    !["admin", "manager", "claims_staff"].includes(role)
  ) {
    return jsonError("You don't have permission to view attachments.", 403);
  }

  const admin = createAdminClient();

  // Confirm the requested path actually belongs to this submission so a
  // staff member can't enumerate arbitrary files.
  const { data: submission } = await admin
    .from("claim_intake_submissions")
    .select("attachments")
    .eq("id", submissionId)
    .single();

  if (!submission) return jsonError("Submission not found.", 404);

  const attachments = (submission.attachments ?? []) as Array<{
    storage_path?: string;
  }>;
  if (!attachments.some((a) => a.storage_path === path)) {
    return jsonError("Attachment not associated with this submission.", 403);
  }

  const { data, error } = await admin.storage
    .from("claim-documents")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[attachment-url] sign failed", error);
    return jsonError("Couldn't generate a download link.", 500);
  }

  // ?redirect=1 → 302 to the signed URL (used by simple anchor tags in the
  // triage UI). Default returns JSON for programmatic consumers.
  if (url.searchParams.get("redirect") === "1") {
    return NextResponse.redirect(data.signedUrl, 302);
  }

  return NextResponse.json({ ok: true, url: data.signedUrl });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
