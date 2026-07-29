/**
 * Central Dispatch integration scaffold
 *
 * Central Dispatch is the auto-transport load board where many NTS auto/RV
 * shipments originate. Linking a claim to its Central Dispatch order lets
 * claims staff jump straight to the source order, pull carrier vetting from
 * that side, and cross-check delivery status when a customer disputes it.
 *
 * SCOPE (v0 — pre-integration):
 *   Signatures + mock only. Same pattern as `lib/integrations/mcp/client.ts`.
 */

export type CentralDispatchOrder = {
  order_number: string;
  status: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  shipper_name: string | null;
  carrier_name: string | null;
  carrier_mc: string | null;
  total_price: number | null;
  raw: Record<string, unknown>;
};

/**
 * Fetch a Central Dispatch order by its order number.
 *
 * @remarks
 * Central Dispatch does not currently publish a public REST API for order
 * details. Real implementation likely requires their B2B integration
 * program or a scraper against the authenticated portal — TBD.
 */
export async function fetchCentralDispatchOrder(
  orderNumber: string,
): Promise<CentralDispatchOrder> {
  const configured = Boolean(
    process.env.CENTRAL_DISPATCH_API_URL &&
      process.env.CENTRAL_DISPATCH_API_KEY,
  );

  if (!configured) {
    return {
      order_number: orderNumber,
      status: "delivered",
      origin_city: "Denver",
      origin_state: "CO",
      destination_city: "Austin",
      destination_state: "TX",
      pickup_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      delivery_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      shipper_name: "NTS AutoTransport",
      carrier_name: "Demo Carrier LLC",
      carrier_mc: "MC-1234567",
      total_price: 1650,
      raw: {
        _mock: true,
        _reason:
          "Central Dispatch env vars not configured. See lib/integrations/central-dispatch/client.ts",
      },
    };
  }

  throw new Error("Live Central Dispatch integration not yet implemented");
}

export function isCentralDispatchConfigured(): boolean {
  return Boolean(
    process.env.CENTRAL_DISPATCH_API_URL &&
      process.env.CENTRAL_DISPATCH_API_KEY,
  );
}
