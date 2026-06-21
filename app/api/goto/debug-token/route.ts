/**
 * GET /api/goto/debug-token
 *
 * Admin-only. Decodes the admin GoTo token and probes queue-caller endpoints.
 * Use this to diagnose why queue-caller.v1.read is not working after re-auth.
 *
 * Returns:
 *   - tokenScopes: scopes embedded in the JWT
 *   - probeResults: HTTP status from each candidate queue-caller endpoint
 *   - storedNumericKey: value in DB
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken, getAdminNumericAccountKey } from "@/lib/goto-utils";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!teamMember?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminToken = await getAdminGoToToken();
  if (!adminToken) {
    return NextResponse.json({ error: "No admin GoTo token stored. Visit /api/goto/auth?admin=true" });
  }

  const numericAccountKey = await getAdminNumericAccountKey(adminToken);

  // Decode the JWT to see embedded scopes
  const payload = decodeJwtPayload(adminToken);
  const tokenScopes: string[] = typeof payload?.sc === "string"
    ? payload.sc.split(" ").filter(Boolean)
    : Array.isArray(payload?.sc) ? payload.sc : [];

  // Probe all candidate endpoints (both queue-caller and voice-admin namespaces)
  const candidates = [
    "https://api.goto.com/voice-admin/v1/call-queues",           // ✅ WORKS - returns queue list
    "https://api.goto.com/voice-admin/v1/queue-calls",           // Test: queue call analytics?
    "https://api.goto.com/voice-admin/v1/call-queue-analytics",  // Test: alternative analytics path?
    "https://api.goto.com/voice-admin/v1/analytics/queue-calls", // Test: another variant?
    "https://api.goto.com/queue-caller/v1/calls",                // ❌ Returns 404
    "https://api.goto.com/queue-caller/v1/conversations",        // ❌ Returns 404
    "https://api.goto.com/cc-analytics/v1/queue-calls",          // ❌ Returns 404
    "https://api.goto.com/analytics/v1/queue-calls",
    "https://api.goto.com/reporting/v1/queue-calls",
  ];

  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const probeResults = await Promise.all(
    candidates.map(async (endpoint) => {
      try {
        const url = new URL(endpoint);
        if (numericAccountKey) url.searchParams.set("accountKey", numericAccountKey);
        url.searchParams.set("startTime", startTime);
        url.searchParams.set("endTime", endTime);
        url.searchParams.set("pageSize", "1");

        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });

        let body: unknown = null;
        try { body = await resp.json(); } catch { /* ignore */ }

        return { endpoint, status: resp.status, body };
      } catch (err) {
        return { endpoint, status: "error", error: String(err) };
      }
    }),
  );

  // Check user's organizational roles and access via Admin API /me endpoint
  let meResponse: any = null;
  try {
    const meResp = await fetch("https://api.getgo.com/admin/rest/v1/me", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Accept: "application/json"
      },
    });

    if (meResp.ok) {
      meResponse = await meResp.json();
    } else {
      meResponse = {
        error: `HTTP ${meResp.status}`,
        body: await meResp.text().catch(() => null)
      };
    }
  } catch (err) {
    meResponse = { error: String(err) };
  }

  // Try SCIM API /Users endpoint to see if we get different error
  let scimUsersResponse: any = null;
  try {
    const scimResp = await fetch("https://api.getgo.com/identity/v1/Users?pageSize=1", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Accept: "application/scim+json",
      },
    });

    scimUsersResponse = {
      status: scimResp.status,
      body: await scimResp.json().catch(() => scimResp.text().catch(() => null)),
    };
  } catch (err) {
    scimUsersResponse = { error: String(err) };
  }

  // Also check the DB for what tokens are stored
  const { data: connections } = await supabase
    .from("goto_connections")
    .select("is_admin_token, numeric_account_key, created_at, updated_at")
    .eq("is_admin_token", true);

  return NextResponse.json({
    numericAccountKey,
    tokenScopes,
    hasQueueCallerScope: tokenScopes.some((s) => s.includes("queue-caller")),
    hasCcAnalyticsScope: tokenScopes.some((s) => s.includes("cc-analytics")),
    probeResults,
    adminApiMe: meResponse,
    scimApiUsers: scimUsersResponse,
    storedConnections: connections ?? [],
    tokenPayloadSummary: payload
      ? { sub: payload.sub, aud: payload.aud, exp: payload.exp, ls: payload.ls }
      : null,
  });
}
