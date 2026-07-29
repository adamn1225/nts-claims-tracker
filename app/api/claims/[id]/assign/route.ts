import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/claims/:id/assign
 * Body: { owner_id: string | null }
 *
 * Sets `claims.owner_id`. RLS gates who can write. `owner_id = null` means
 * "return to the unassigned queue".
 */
export async function PATCH(
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

  const body = (await req.json()) as { owner_id?: string | null };
  const ownerId = body.owner_id ?? null;

  // Basic sanity check — if a value is provided, make sure the profile exists
  // (RLS is not enough because it would silently no-op).
  if (ownerId) {
    const { data: target } = await supabase
      .from("profiles")
      .select("id, is_active, role")
      .eq("id", ownerId)
      .single();
    if (!target || !target.is_active) {
      return NextResponse.json(
        { error: "Owner must be an active user" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("claims")
    .update({ owner_id: ownerId })
    .eq("id", claimId)
    .select("id, owner_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ claim: data });
}
