import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = [
  "not_filed",
  "filed_not_acknowledged",
  "acknowledged",
  "closed",
] as const;
type FilingStatus = (typeof VALID)[number];

/**
 * PATCH /api/claims/:id/filing-status
 * Body: { filing_status: FilingStatus }
 *
 * Also stamps `claims.filed_at` the first time the row transitions from
 * `not_filed` to any filed state.
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

  const body = (await req.json()) as { filing_status?: string };
  if (!body.filing_status || !VALID.includes(body.filing_status as FilingStatus)) {
    return NextResponse.json(
      { error: `filing_status must be one of ${VALID.join(", ")}` },
      { status: 400 },
    );
  }
  const next = body.filing_status as FilingStatus;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- filing_status
  // was added post-typegen; treat client as loosely typed until db:types runs.
  const client = supabase as any;

  const { data: existing } = await client
    .from("claims")
    .select("filing_status, filed_at")
    .eq("id", claimId)
    .single();

  const patch: Record<string, unknown> = { filing_status: next };
  if (
    next !== "not_filed" &&
    (!existing?.filed_at || existing?.filing_status === "not_filed")
  ) {
    patch.filed_at = new Date().toISOString();
  }
  if (next === "not_filed") {
    patch.filed_at = null;
  }

  const { data, error } = await client
    .from("claims")
    .update(patch)
    .eq("id", claimId)
    .select("id, filing_status, filed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ claim: data });
}
