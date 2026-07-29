/**
 * Descartes MCP (My Carrier Portal) integration scaffold
 *
 * DOCS (upstream):
 *   - https://api.descartes.com/apis                (Descartes API catalog)
 *   - https://mycarrierpackets.com/IntegrationGuide (MyCarrierPackets Integration Guide)
 *
 * SCOPE (v0 — pre-integration):
 *   This file currently only exports typed function signatures + a
 *   mock implementation. It is intended to be the single import surface
 *   for the app so we can wire the real HTTP client later without
 *   touching UI code.
 *
 * WHEN TO SWITCH TO A REAL CLIENT:
 *   1. Obtain sandbox credentials from Descartes / MCP support.
 *   2. Set env vars in `.env.local`:
 *        MCP_API_BASE_URL=https://api.descartes.com/...
 *        MCP_API_KEY=...
 *        MCP_API_SECRET=...
 *   3. Replace the internals of `verifyCarrier()` with the real fetch to
 *      MCP's carrier lookup endpoint. Shape returned to the app should not
 *      change.
 */

export type CarrierVerificationResult = {
  status: "verified" | "flagged" | "pending" | "failed" | "expired";
  legal_name: string | null;
  dba_name: string | null;
  dot_number: string | null;
  mc_number: string | null;
  insurance_carrier: string | null;
  insurance_expiry: string | null; // ISO date
  operating_status: string | null;
  flags: string[]; // e.g. ["insurance_expired", "safety_rating_conditional"]
  fetched_at: string; // ISO datetime
  raw: Record<string, unknown>;
};

export type CarrierLookupParams = {
  dotNumber?: string | null;
  mcNumber?: string | null;
  companyName?: string | null;
};

/**
 * Look up a carrier in MCP by DOT #, MC #, or legal name.
 *
 * @remarks
 * Current implementation returns a canned mock so the UI works end-to-end
 * before the vendor account is provisioned. Do not ship to prod until this
 * is replaced.
 */
export async function verifyCarrier(
  params: CarrierLookupParams,
): Promise<CarrierVerificationResult> {
  const configured = Boolean(
    process.env.MCP_API_BASE_URL &&
      process.env.MCP_API_KEY &&
      process.env.MCP_API_SECRET,
  );

  if (!configured) {
    // Mock response — deterministic based on input so demos are stable.
    const identifier =
      params.dotNumber || params.mcNumber || params.companyName || "unknown";
    return {
      status: "verified",
      legal_name: params.companyName ?? `Carrier ${identifier}`,
      dba_name: null,
      dot_number: params.dotNumber ?? null,
      mc_number: params.mcNumber ?? null,
      insurance_carrier: "Progressive Commercial",
      insurance_expiry: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10),
      operating_status: "AUTHORIZED FOR Property",
      flags: [],
      fetched_at: new Date().toISOString(),
      raw: {
        _mock: true,
        _reason:
          "MCP env vars not configured. See lib/integrations/mcp/client.ts",
        params,
      },
    };
  }

  // TODO: Real MCP call — placeholder shape only.
  throw new Error("Live MCP integration not yet implemented");
}

export function isMcpConfigured(): boolean {
  return Boolean(
    process.env.MCP_API_BASE_URL &&
      process.env.MCP_API_KEY &&
      process.env.MCP_API_SECRET,
  );
}
