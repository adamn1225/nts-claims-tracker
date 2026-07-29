import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewTransactionPayload = {
  transaction_type:
    | "inbound_payment"
    | "outbound_payment"
    | "concession"
    | "adjustment"
    | "recovery"
    | "direct_payment";
  payment_source:
    | "carrier"
    | "insurance"
    | "nts"
    | "broker"
    | "shipper"
    | "customer"
    | "factoring"
    | "unknown"
    | "other";
  amount: number;
  currency?: string;
  transaction_date?: string; // yyyy-mm-dd
  gl_code?: string | null;
  reference_number?: string | null;
  from_party_id?: string | null;
  to_party_id?: string | null;
  notes?: string | null;
};

/**
 * GET  /api/claims/:id/transactions — list all transactions for a claim
 * POST /api/claims/:id/transactions — log a new transaction
 *
 * RLS gates access; we just pass the query through.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- claim_transactions
  // was added in migration 20260728000001 and may not be reflected in
  // lib/database.types.ts yet. Cast until db:types is run.
  const client = supabase as any;

  const { data, error } = await client
    .from("claim_transactions")
    .select(
      `id, transaction_type, payment_source, amount, currency,
       transaction_date, gl_code, reference_number, notes,
       from_party_id, to_party_id, logged_by, created_at`,
    )
    .eq("claim_id", claimId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET transactions] error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ transactions: data ?? [] });
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

  const body = (await req.json()) as NewTransactionPayload;

  // Minimal validation — the DB has more constraints via CHECK + enum types.
  if (!body.transaction_type || !body.payment_source) {
    return NextResponse.json(
      { error: "transaction_type and payment_source are required" },
      { status: 400 },
    );
  }
  if (typeof body.amount !== "number" || body.amount < 0) {
    return NextResponse.json(
      { error: "amount must be a non-negative number" },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data, error } = await client
    .from("claim_transactions")
    .insert({
      claim_id: claimId,
      transaction_type: body.transaction_type,
      payment_source: body.payment_source,
      amount: body.amount,
      currency: body.currency || "USD",
      transaction_date: body.transaction_date || undefined,
      gl_code: body.gl_code || null,
      reference_number: body.reference_number || null,
      from_party_id: body.from_party_id || null,
      to_party_id: body.to_party_id || null,
      notes: body.notes || null,
      logged_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST transactions] error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ transaction: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: claimId } = await params;
  const url = new URL(req.url);
  const txnId = url.searchParams.get("txn_id");
  if (!txnId) {
    return NextResponse.json({ error: "txn_id is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("claim_transactions")
    .delete()
    .eq("id", txnId)
    .eq("claim_id", claimId);

  if (error) {
    console.error("[DELETE transactions] error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
