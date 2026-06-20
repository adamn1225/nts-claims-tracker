import { NextResponse } from "next/server";

/**
 * GET /api/time
 *
 * Returns the authoritative server time so the client can detect a skewed
 * local clock (a common cause of unexpected auth sign-outs). Intentionally
 * unauthenticated and uncached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { epochMs: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
