import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/intake/[id]/reject
 *
 * Marks a submission as `rejected` with an optional review note.
 * Does NOT delete attachments — those stay in storage for audit.
 *
 * Body: { note?: string }
 * Auth: claims_staff, manager, or admin.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: submissionId } = await ctx.params;

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
    return jsonError("You don't have permission to reject submissions.", 403);
  }

  let body: { note?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("claim_intake_submissions")
    .select("status")
    .eq("id", submissionId)
    .single();

  if (!existing) return jsonError("Submission not found.", 404);
  if (existing.status !== "pending_review") {
    return jsonError(
      `This submission is already marked "${existing.status}".`,
      409,
    );
  }

  const { error } = await admin
    .from("claim_intake_submissions")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body.note?.trim() || null,
    })
    .eq("id", submissionId);

  if (error) {
    console.error("[reject] update failed", error);
    return jsonError("Couldn't update the submission.", 500);
  }

  return NextResponse.json({ ok: true });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
