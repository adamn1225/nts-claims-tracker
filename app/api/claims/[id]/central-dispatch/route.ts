import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCentralDispatchOrder,
  isCentralDispatchConfigured,
} from "@/lib/integrations/central-dispatch/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/claims/:id/central-dispatch
 *
 * Body: { order_number: string }
 *
 * Fetches details from Central Dispatch and stores the order number on
 * `claims.central_dispatch_order_number`. Returns the fetched order so the
 * UI can display a summary card without a second round trip.
 */
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

  const body = (await req.json()) as { order_number?: string };
  if (!body.order_number || !body.order_number.trim()) {
    return NextResponse.json(
      { error: "order_number is required" },
      { status: 400 },
    );
  }

  const orderNumber = body.order_number.trim();
  const order = await fetchCentralDispatchOrder(orderNumber);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new column
  const client = supabase as any;

  const { error } = await client
    .from("claims")
    .update({ central_dispatch_order_number: orderNumber })
    .eq("id", claimId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    order,
    live: isCentralDispatchConfigured(),
  });
}
