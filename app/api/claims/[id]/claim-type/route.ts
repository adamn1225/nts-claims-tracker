import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_TYPES } from "@/lib/constants/claim-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(CLAIM_TYPES.map((c) => c.value));

/**
 * PATCH /api/claims/:id/claim-type
 * Body: { claim_type: ClaimType | null }
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

  const body = (await req.json()) as { claim_type?: string | null };
  const next = body.claim_type ?? null;
  if (next !== null && !VALID.has(next as (typeof CLAIM_TYPES)[number]["value"])) {
    return NextResponse.json(
      { error: `claim_type must be one of ${[...VALID].join(", ")}` },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new column
  const client = supabase as any;
  const { data, error } = await client
    .from("claims")
    .update({ claim_type: next })
    .eq("id", claimId)
    .select("id, claim_type")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ claim: data });
}
