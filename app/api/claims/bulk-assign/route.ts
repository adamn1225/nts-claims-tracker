import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/claims/bulk-assign
 * Body: { claim_ids: string[], owner_id: string | null }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as {
    claim_ids?: string[];
    owner_id?: string | null;
  };
  const ids = (body.claim_ids ?? []).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "claim_ids required" }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json(
      { error: "Max 100 claims per bulk operation" },
      { status: 400 },
    );
  }

  const ownerId = body.owner_id ?? null;
  if (ownerId) {
    const { data: target } = await supabase
      .from("profiles")
      .select("id, is_active")
      .eq("id", ownerId)
      .single();
    if (!target?.is_active) {
      return NextResponse.json(
        { error: "Owner must be an active user" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("claims")
    .update({ owner_id: ownerId })
    .in("id", ids)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
