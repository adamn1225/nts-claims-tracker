import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCarrier, isMcpConfigured } from "@/lib/integrations/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/claims/:id/mcp-verify
 *
 * Body: { company_id: string }
 *
 * Runs a Descartes MCP carrier verification lookup for the party's company,
 * stores the result in `carrier_verifications`, and back-links the newest
 * verification onto the claim (`claims.mcp_verification_id`).
 *
 * v0: uses the mock client at lib/integrations/mcp/client.ts until MCP
 * credentials are provisioned.
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

  const body = (await req.json()) as { company_id?: string };
  if (!body.company_id) {
    return NextResponse.json(
      { error: "company_id is required" },
      { status: 400 },
    );
  }

  // Load the company so we know how to identify it to MCP.
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, legal_name, dba_name, dot_number, mc_number")
    .eq("id", body.company_id)
    .single();

  if (companyErr || !company) {
    return NextResponse.json(
      { error: companyErr?.message ?? "Company not found" },
      { status: 404 },
    );
  }

  const result = await verifyCarrier({
    dotNumber: company.dot_number,
    mcNumber: company.mc_number,
    companyName: company.legal_name || company.dba_name,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new table
  const client = supabase as any;

  const { data: verification, error: insertErr } = await client
    .from("carrier_verifications")
    .insert({
      company_id: company.id,
      source: "descartes_mcp",
      status: result.status,
      dot_number: result.dot_number,
      mc_number: result.mc_number,
      legal_name: result.legal_name,
      dba_name: result.dba_name,
      insurance_carrier: result.insurance_carrier,
      insurance_expiry: result.insurance_expiry,
      operating_status: result.operating_status,
      raw_response: result.raw,
      requested_by: user.id,
      notes: result.flags.length ? `Flags: ${result.flags.join(", ")}` : null,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  // Back-link on the claim for quick UI access.
  await client
    .from("claims")
    .update({ mcp_verification_id: verification.id })
    .eq("id", claimId);

  return NextResponse.json({
    verification,
    live: isMcpConfigured(),
  });
}
