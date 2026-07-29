import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/import-claims
 *
 * FreightClaims → NTS Claims Tracker CSV import.
 *
 * Body (JSON):
 *   {
 *     dryRun: boolean,
 *     rows: Array<{
 *       claim_number?: string,        // becomes `freightclaims_legacy_number` (or auto if missing)
 *       customer_name?: string,       // shipper company
 *       carrier_name?: string,
 *       amount?: number,              // damage_claim_amount
 *       bol_number?: string,
 *       tms_order_number?: string,
 *       opened_at?: string,           // ISO date
 *       filing_status?: string,
 *     }>
 *   }
 *
 * Behavior:
 *   - Requires admin or manager
 *   - Finds/creates a "freightclaims_legacy" inbox status (falls back to any inbox status)
 *   - Dedupes companies by ilike-name (same rule as intake promote)
 *   - Sets `intake_source='freightclaims_legacy'` on every row
 *   - dryRun=true returns a preview without writing
 */

type ImportRow = {
  claim_number?: string;
  customer_name?: string;
  carrier_name?: string;
  amount?: number | string;
  bol_number?: string;
  tms_order_number?: string;
  opened_at?: string;
  filing_status?: string;
};

type ImportResultRow = {
  index: number;
  claim_number: string | null;
  shipper: string | null;
  carrier: string | null;
  amount: number | null;
  action: "created" | "skipped" | "error";
  error?: string;
};

async function findOrCreateCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client
  admin: any,
  name: string,
  kind: "shipper" | "carrier",
): Promise<string> {
  const { data: found } = await admin
    .from("companies")
    .select("id, kinds")
    .ilike("legal_name", name)
    .limit(1)
    .maybeSingle();
  if (found) {
    if (!found.kinds?.includes(kind)) {
      await admin
        .from("companies")
        .update({ kinds: Array.from(new Set([...(found.kinds ?? []), kind])) })
        .eq("id", found.id);
    }
    return found.id;
  }
  const { data: created, error } = await admin
    .from("companies")
    .insert({
      legal_name: name,
      kinds: [kind],
      external_source: "freightclaims_import",
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    dryRun?: boolean;
    rows?: ImportRow[];
  };
  const rows = body.rows ?? [];
  const dryRun = body.dryRun ?? true;

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: "Batch too large — cap at 500 rows per call" },
      { status: 400 },
    );
  }

  // Look up inbox status once
  const { data: inboxStatus } = await supabase
    .from("claim_statuses")
    .select("id")
    .eq("is_inbox", true)
    .order("position")
    .limit(1)
    .maybeSingle();

  if (!inboxStatus) {
    return NextResponse.json(
      { error: "No inbox status configured" },
      { status: 500 },
    );
  }

  // Preview
  const preview: ImportResultRow[] = rows.map((r, i) => ({
    index: i,
    claim_number: r.claim_number ?? null,
    shipper: r.customer_name ?? null,
    carrier: r.carrier_name ?? null,
    amount:
      typeof r.amount === "string"
        ? Number(r.amount.replace(/[^0-9.-]/g, ""))
        : (r.amount ?? null),
    action: "created",
  }));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      preview,
      status_id: inboxStatus.id,
      total: rows.length,
    });
  }

  // Real write path — uses admin client to bypass RLS for bulk create,
  // caller already gated by role check above.
  const admin = createAdminClient();
  const results: ImportResultRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      let shipperId: string | null = null;
      let carrierId: string | null = null;
      if (r.customer_name?.trim()) {
        shipperId = await findOrCreateCompany(
          admin,
          r.customer_name.trim(),
          "shipper",
        );
      }
      if (r.carrier_name?.trim()) {
        carrierId = await findOrCreateCompany(
          admin,
          r.carrier_name.trim(),
          "carrier",
        );
      }

      const amount = preview[i].amount ?? null;

      const { data: claim, error: claimErr } = await admin
        .from("claims")
        .insert({
          status_id: inboxStatus.id,
          intake_source: "freightclaims_legacy",
          bol_number: r.bol_number || null,
          tms_order_number: r.tms_order_number || null,
          damage_claim_amount: amount,
          opened_at: r.opened_at || new Date().toISOString(),
          summary: r.claim_number ? `Legacy FreightClaims # ${r.claim_number}` : null,
          filing_status: (r.filing_status as "not_filed" | "filed_not_acknowledged" | "acknowledged" | "closed") || "filed_not_acknowledged",
          owner_id: user.id,
          created_by: user.id,
        })
        .select("id, claim_number")
        .single();

      if (claimErr || !claim) throw claimErr ?? new Error("insert failed");

      const partyInserts: Array<{
        claim_id: string;
        company_id: string;
        role: "shipper" | "carrier";
        created_by: string;
      }> = [];
      if (shipperId)
        partyInserts.push({
          claim_id: claim.id,
          company_id: shipperId,
          role: "shipper",
          created_by: user.id,
        });
      if (carrierId)
        partyInserts.push({
          claim_id: claim.id,
          company_id: carrierId,
          role: "carrier",
          created_by: user.id,
        });
      if (partyInserts.length) {
        await admin.from("claim_parties").insert(partyInserts);
      }

      results.push({
        index: i,
        claim_number: claim.claim_number,
        shipper: r.customer_name ?? null,
        carrier: r.carrier_name ?? null,
        amount,
        action: "created",
      });
    } catch (err) {
      results.push({
        index: i,
        claim_number: r.claim_number ?? null,
        shipper: r.customer_name ?? null,
        carrier: r.carrier_name ?? null,
        amount: preview[i].amount ?? null,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    dryRun: false,
    imported: results.filter((r) => r.action === "created").length,
    errored: results.filter((r) => r.action === "error").length,
    results,
  });
}
