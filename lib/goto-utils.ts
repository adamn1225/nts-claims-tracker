/**
 * Shared GoTo Connect API utilities.
 *
 * Centralizes token management so the same refresh logic isn't duplicated
 * across every GoTo API route. Every route that needs a GoTo access token
 * should call `getGoToAccessToken()` rather than inlining the refresh flow.
 */

import { createClient } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/lib/encryption";

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/**
 * Decode the payload of a GoTo JWT without verifying the signature.
 * GoTo access tokens are JWTs that contain `account_key` as a claim.
 * Returns null on any parse error.
 */
export function decodeGoToJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract the account_key from a GoTo JWT access token.
 * GoTo JWTs use the `ls` claim as the org/account identifier (UUID format).
 * Also checks `account_key`, `acctKey`, `orgKey` for forward compatibility.
 */
export function extractAccountKeyFromToken(token: string): string | null {
  const payload = decodeGoToJwt(token);
  if (!payload) return null;
  return (payload["account_key"] as string | undefined)
    ?? (payload["acctKey"] as string | undefined)
    ?? (payload["orgKey"] as string | undefined)
    ?? (payload["ls"] as string | undefined)  // GoTo's org/account identifier (UUID)
    ?? null;
}

// ─── Token management ─────────────────────────────────────────────────────────

/**
 * Returns a valid GoTo access token for `userId`.
 * Refreshes the stored token if it expires within the next 5 minutes.
 * Returns `null` if the user has no GoTo connection or refresh fails.
 */
export async function getGoToAccessToken(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("goto_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection) return null;

  const expiresAt = new Date(connection.expires_at);
  const fiveMinutesOut = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesOut) {
    return decrypt(connection.access_token);
  }

  // Token is expiring — attempt a refresh
  const clientId = process.env.GOTO_CLIENT_ID;
  const clientSecret = process.env.GOTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const refreshToken = decrypt(connection.refresh_token);
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const resp = await fetch("https://authentication.logmeininc.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!resp.ok) {
      console.error("[GotoUtils] Token refresh failed:", resp.status);
      return null;
    }

    const data = await resp.json();
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from("goto_connections")
      .update({
        access_token: encrypt(data.access_token),
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return data.access_token;
  } catch (err) {
    console.error("[GotoUtils] Token refresh error:", err);
    return null;
  }
}

/**
 * Returns the GoTo connection record (including account_key and goto_user_email)
 * for `userId`, or null if not connected.
 */
export async function getGoToConnection(userId: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_key: string | null;
  goto_user_email: string | null;
  goto_user_key: string | null;
  preferred_device_id: string | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goto_connections")
    .select(
      "access_token, refresh_token, expires_at, account_key, goto_user_email, goto_user_key, preferred_device_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  return (data as typeof data & { goto_user_key: string | null }) ?? null;
}

// ─── Typed API response helpers ───────────────────────────────────────────────

/** A single call record from /call-history/v1/calls */
export interface GoToCallRecord {
  id: string;
  startTime: string;
  /** Duration in seconds */
  duration: number;
  /** "inbound" | "outbound" | "internal" */
  direction: string;
  caller: { number: string; name?: string };
  callee: { number: string; name?: string };
  /**
   * e.g. "answered_normally", "no_answer", "busy", "caller_abandoned",
   * "voicemail", "failed"
   */
  result: string;
  /** Recording details (if available) */
  recording?: {
    id: string;
    status?: string;
    hasTranscription?: boolean;
    transcriptionId?: string;
  };
}

/** A voicemail record from /voicemail/v1/voicemailboxes/{id}/voicemails */
export interface GoToVoicemail {
  id: string;
  caller: { number: string; name?: string };
  /** ISO timestamp — GoTo API returns this as `timestamp`, normalised here */
  received: string;
  /** Raw API field — same value as `received`, kept for direct API mapping */
  timestamp?: string;
  /** Duration in seconds */
  duration: number;
  heard: boolean;
  transcription?: string; // populated by enrichVoicemailTranscriptions()
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/**
 * Normalizes a phone number to E.164 digits-only for comparison.
 * "  (954) 826-4318 " → "9548264318"  (10-digit US) or "19548264318" (11-digit)
 */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Returns true if `callNumber` matches `targetPhone` after digit normalization.
 * Handles leading "1" differences (US): 9549001234 matches 19549001234.
 */
export function phoneMatches(callNumber: string, targetPhone: string): boolean {
  const a = normalizePhoneDigits(callNumber);
  const b = normalizePhoneDigits(targetPhone);
  if (a === b) return true;
  // Strip leading "1" from the 11-digit side and retry
  if (a.length === 11 && a[0] === "1" && a.slice(1) === b) return true;
  if (b.length === 11 && b[0] === "1" && b.slice(1) === a) return true;
  return false;
}

/**
 * Fetches call history for the authenticated user from GoTo.
 * Returns all calls within `lookbackDays` days, then filters client-side by
 * the given phone numbers so we get all communication with the customer
 * regardless of which number they called from.
 */
export async function fetchGoToCallHistory(
  accessToken: string,
  customerPhones: string[],
  lookbackDays = 90,
): Promise<GoToCallRecord[]> {
  const startTime = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const endTime = new Date().toISOString();

  const url = new URL("https://api.goto.com/call-history/v1/calls");
  url.searchParams.set("startTime", startTime);
  url.searchParams.set("endTime", endTime);
  url.searchParams.set("pageSize", "200");

  try {
    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      console.warn("[GotoUtils] call-history fetch failed:", resp.status);
      return [];
    }

    const data = await resp.json();
    const allCalls: GoToCallRecord[] = data?.items ?? [];

    // Filter to calls involving any of the customer's phone numbers
    if (customerPhones.length === 0) return allCalls;

    return allCalls.filter((call) =>
      customerPhones.some(
        (p) =>
          phoneMatches(call.caller.number, p) ||
          phoneMatches(call.callee.number, p),
      ),
    );
  } catch (err) {
    console.error("[GotoUtils] fetchGoToCallHistory error:", err);
    return [];
  }
}

/**
 * Fetches voicemails for the user's voicemailbox.
 * Requires knowing the voicemailbox ID — obtained from the admin API.
 * Returns voicemails from the last `lookbackDays` days.
 */
export async function fetchGoToVoicemails(
  accessToken: string,
  accountKey: string,
  customerPhones: string[],
  lookbackDays = 90,
): Promise<GoToVoicemail[]> {
  // Step 1: Get the user's voicemailbox list
  try {
    const vmboxUrl = `https://api.goto.com/voicemail/v1/voicemailboxes?accountKey=${encodeURIComponent(accountKey)}`;
    const vmboxResp = await fetch(vmboxUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!vmboxResp.ok) {
      console.warn("[GotoUtils] voicemailboxes fetch failed:", vmboxResp.status);
      return [];
    }

    const vmboxData = await vmboxResp.json();
    const voicemailboxId: string | undefined =
      vmboxData?.items?.[0]?.id ?? vmboxData?.[0]?.id;

    if (!voicemailboxId) {
      console.warn("[GotoUtils] No voicemailbox ID found");
      return [];
    }

    // Step 2: Get voicemails from this box
    const since = new Date(
      Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const vmUrl = new URL(
      `https://api.goto.com/voicemail/v1/voicemailboxes/${voicemailboxId}/voicemails`,
    );
    vmUrl.searchParams.set("pageSize", "50");

    const vmResp = await fetch(vmUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!vmResp.ok) {
      console.warn("[GotoUtils] voicemails fetch failed:", vmResp.status);
      return [];
    }

    const vmData = await vmResp.json();
    const allVoicemails: GoToVoicemail[] = (vmData?.items ?? []).map((item: any) => ({
      ...item,
      received: item.timestamp ?? item.received ?? "",
    }));

    // Filter by date and customer phone
    const cutoff = new Date(since);

    const filtered = allVoicemails.filter((vm) => {
      if (new Date(vm.received) < cutoff) return false;
      if (customerPhones.length === 0) return true;
      return customerPhones.some((p) => phoneMatches(vm.caller.number, p));
    });

    return filtered;
  } catch (err) {
    console.error("[GotoUtils] fetchGoToVoicemails error:", err);
    return [];
  }
}

/**
 * Enriches voicemail records with transcription text.
 * Fetches transcriptions for each voicemail in parallel (up to 5).
 * Voicemails without a completed transcription are returned with transcription = undefined.
 */
export async function enrichVoicemailTranscriptions(
  accessToken: string,
  voicemails: GoToVoicemail[],
): Promise<GoToVoicemail[]> {
  // Only attempt transcriptions for up to the 5 most recent voicemails
  const toEnrich = voicemails.slice(0, 5);

  const enriched = await Promise.all(
    toEnrich.map(async (vm) => {
      try {
        const resp = await fetch(
          `https://api.goto.com/voicemail/v1/voicemails/${vm.id}/transcription`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (!resp.ok) return vm;

        const data = await resp.json();
        if (data?.status === "SUCCESS" && data?.text) {
          return { ...vm, transcription: data.text as string };
        }
        return vm;
      } catch {
        return vm;
      }
    }),
  );

  // Append any in the original list beyond the 5 we enriched (no transcription attempt)
  return [
    ...enriched,
    ...voicemails.slice(5),
  ];
}

// ─── Formatting helpers (used in prompts) ─────────────────────────────────────

/** Formats seconds into "Xm Ys" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Formats an ISO date to a readable short form: "Mar 15, 2026" */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Admin proxy helpers ──────────────────────────────────────────────────────

/**
 * Returns a valid GoTo access token for the org admin connection (the row
 * in goto_connections where is_admin_token = true).
 * Returns null if no admin connection exists or the refresh fails.
 */
export async function getAdminGoToToken(): Promise<string | null> {
  const supabase = await createClient();

  console.log("[getAdminGoToToken] Looking for admin token...");

  // Use limit(1) rather than maybeSingle() so multiple GoTo-admin accounts
  // (e.g. multiple ClaimsTracker admins who each connected via ?admin=true)
  // don't cause an error — any valid admin token is fine.
  const { data: connections, error: queryError } = await supabase
    .from("goto_connections")
    .select("user_id, access_token, refresh_token, expires_at")
    .eq("is_admin_token", true)
    .order("updated_at", { ascending: false })  // Always pick the most recently refreshed token
    .limit(1);

  console.log("[getAdminGoToToken] Query result:", {
    found: !!connections?.[0],
    connectionCount: connections?.length ?? 0,
    error: queryError?.message,
  });

  const connection = connections?.[0] ?? null;
  if (!connection) {
    console.warn("[getAdminGoToToken] No admin token found in goto_connections table");
    return null;
  }

  // Reuse the per-user token helper — admin connection is stored under its own user_id
  return getGoToAccessToken(connection.user_id);
}

/**
 * Resolves a GoTo access token suitable for fetching call history on behalf
 * of a specific NTS broker (`brokerUserId`).
 *
 * Resolution order:
 *   1. Broker's own individual GoTo connection (most accurate — their own device line)
 *   2. Admin GoTo proxy token — works when the broker has no individual connection
 *      but requires knowing the broker's GoTo user key so calls can be scoped
 *
 * Returns:
 *   { token, gotoUserKey, isAdminProxy }
 *   - token:        access token to use for GoTo API calls
 *   - gotoUserKey:  GoTo platform user key to scope /call-history/v1/users/{key}/calls
 *                   null when using the broker's own token (API is already user-scoped)
 *   - isAdminProxy: true when falling back to the org admin token
 */
export async function resolveGoToTokenForBroker(brokerUserId: string): Promise<{
  token: string;
  gotoUserKey: string | null;
  isAdminProxy: boolean;
} | null> {
  console.log(`[resolveGoToTokenForBroker] Starting token resolution for broker: ${brokerUserId}`);

  // 1. Try broker's own connection first
  const brokerConnection = await getGoToConnection(brokerUserId);
  console.log(`[resolveGoToTokenForBroker] Broker connection found:`, !!brokerConnection);

  if (brokerConnection) {
    const token = await getGoToAccessToken(brokerUserId);
    if (token) {
      console.log(`[resolveGoToTokenForBroker] ✅ Using broker's own token (not admin proxy)`);
      return { token, gotoUserKey: null, isAdminProxy: false };
    }
  }

  console.log(`[resolveGoToTokenForBroker] No broker token, falling back to admin proxy...`);

  // 2. Fall back to admin proxy token
  const supabase = await createClient();

  // Check for a cached goto_user_key first (populated by /api/goto/admin-users)
  // Broker may have no goto_connections row at all — that's fine, we look them up by email.
  let gotoUserKey: string | null = brokerConnection?.goto_user_key ?? null;

  if (!gotoUserKey) {
    // Live lookup: resolve the broker's GoTo user key from their NTS email address
    const { data: broker } = await supabase
      .from("brokers")
      .select("email")
      .eq("id", brokerUserId)
      .maybeSingle();

    if (broker?.email) {
      gotoUserKey = await lookupGotoUserKeyByEmail(broker.email);
    }

    // Cache the result so subsequent calls skip the live API lookup
    if (gotoUserKey) {
      if (brokerConnection) {
        await supabase
          .from("goto_connections")
          .update({ goto_user_key: gotoUserKey })
          .eq("user_id", brokerUserId);
      } else {
        // Broker has no connection row — nothing to cache on, but the key is in memory for this request
      }
    }
  }

  if (!gotoUserKey) {
    console.warn(`[resolveGoToTokenForBroker] No GoTo user key found for broker ${brokerUserId} — admin has not connected GoTo org-wide or broker email does not match a GoTo account`);
    return null;
  }

  console.log(`[resolveGoToTokenForBroker] Fetching admin token for broker ${brokerUserId} with userKey ${gotoUserKey}`);
  const adminToken = await getAdminGoToToken();
  if (!adminToken) {
    console.warn("[resolveGoToTokenForBroker] Admin GoTo token not found — visit /api/goto/auth?admin=true to connect");
    return null;
  }

  console.log(`[resolveGoToTokenForBroker] ✅ Successfully resolved admin proxy token for broker ${brokerUserId}`);
  return { token: adminToken, gotoUserKey, isAdminProxy: true };
}

/**
 * Given a user email, fetches their GoTo internal user key from the admin API.
 * Caches nothing — callers should cache as needed.
 * Returns null on any failure.
 */
export async function lookupGotoUserKeyByEmail(email: string): Promise<string | null> {
  const adminToken = await getAdminGoToToken();
  if (!adminToken) return null;

  // Get numeric account key (required by legacy admin API)
  const numericKey = await getAdminNumericAccountKey(adminToken);
  if (!numericKey) return null;

  try {
    // Paginate through users and match by email
    let offset = 0;
    const pageSize = 200;
    while (true) {
      const url = new URL(`https://api.getgo.com/admin/rest/v1/accounts/${numericKey}/users`);
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("offset", String(offset));

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });
      if (!resp.ok) break;

      const data = await resp.json();
      const results = data?.results ?? [];
      const match = results.find((u: { email?: string; key?: number | string }) =>
        u.email?.toLowerCase() === email.toLowerCase()
      );
      if (match) return String(match.key);
      if (results.length < pageSize) break;
      offset += pageSize;
    }
    return null;
  } catch (err) {
    console.error("[GotoUtils] lookupGotoUserKeyByEmail error:", err);
    return null;
  }
}

/**
 * Like fetchGoToCallHistory but uses a specific GoTo user key (for admin proxy).
 * Calls GET /call-history/v1/users/{gotoUserKey}/calls instead of /calls (self).
 */
export async function fetchGoToCallHistoryForUser(
  accessToken: string,
  gotoUserKey: string,
  customerPhones: string[],
  lookbackDays = 90,
): Promise<GoToCallRecord[]> {
  const startTime = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const endTime = new Date().toISOString();

  const allCalls: GoToCallRecord[] = [];
  let pageMarker: string | null = null;

  try {
    while (true) {
      const url = new URL(`https://api.goto.com/call-history/v1/users/${encodeURIComponent(gotoUserKey)}/calls`);
      url.searchParams.set("startTime", startTime);
      url.searchParams.set("endTime", endTime);
      url.searchParams.set("pageSize", "1000");
      if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

      const resp = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        console.warn("[GotoUtils] admin call-history fetch failed:", resp.status, await resp.text());
        break;
      }

      const data = await resp.json();
      const items: GoToCallRecord[] = data?.items ?? [];
      allCalls.push(...items);

      pageMarker = data?.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
    }
  } catch (err) {
    console.error("[GotoUtils] fetchGoToCallHistoryForUser error:", err);
    return [];
  }

  if (customerPhones.length === 0) return allCalls;

  return allCalls.filter((call) =>
    customerPhones.some(
      (p) =>
        phoneMatches(call.caller.number, p) ||
        phoneMatches(call.callee.number, p),
    ),
  );
}

/**
 * Like fetchGoToVoicemails but scoped to a specific GoTo user key (admin proxy).
 */
export async function fetchGoToVoicemailsForUser(
  accessToken: string,
  gotoUserKey: string,
  accountKey: string,
  customerPhones: string[],
  lookbackDays = 90,
): Promise<GoToVoicemail[]> {
  try {
    const vmboxUrl = new URL("https://api.goto.com/voicemail/v1/voicemailboxes");
    vmboxUrl.searchParams.set("accountKey", accountKey);
    vmboxUrl.searchParams.set("userKey", gotoUserKey);

    const vmboxResp = await fetch(vmboxUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!vmboxResp.ok) {
      console.warn("[GotoUtils] admin voicemailboxes fetch failed:", vmboxResp.status);
      return [];
    }

    const vmboxData = await vmboxResp.json();
    const voicemailboxId: string | undefined =
      vmboxData?.items?.[0]?.id ?? vmboxData?.[0]?.id;

    if (!voicemailboxId) return [];

    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const cutoff = new Date(since);

    const vmUrl = new URL(
      `https://api.goto.com/voicemail/v1/voicemailboxes/${voicemailboxId}/voicemails`,
    );
    vmUrl.searchParams.set("pageSize", "50");

    const vmResp = await fetch(vmUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!vmResp.ok) return [];

    const vmData = await vmResp.json();
    const allVoicemails: GoToVoicemail[] = (vmData?.items ?? []).map((item: any) => ({
      ...item,
      received: item.timestamp ?? item.received ?? "",
    }));

    return allVoicemails.filter((vm) => {
      if (new Date(vm.received) < cutoff) return false;
      if (customerPhones.length === 0) return true;
      return customerPhones.some((p) => phoneMatches(vm.caller.number, p));
    });
  } catch (err) {
    console.error("[GotoUtils] fetchGoToVoicemailsForUser error:", err);
    return [];
  }
}

// ─── Formatting helpers (used in prompts) ─────────────────────────────────────

/**
 * Converts GoTo call history + voicemails into a plain-text block
 * suitable for injection into an AI prompt.
 */
export function buildGoToContextBlock(
  calls: GoToCallRecord[],
  voicemails: GoToVoicemail[],
): string {
  const lines: string[] = [];

  if (calls.length === 0 && voicemails.length === 0) {
    return "No GoTo communication history found for this contact's phone number(s).";
  }

  if (calls.length > 0) {
    lines.push("ACTUAL CALL HISTORY (from GoTo phone system):");
    const sorted = [...calls].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
    for (const call of sorted.slice(0, 10)) {
      const dir = call.direction === "inbound" ? "INBOUND" : "OUTBOUND";
      const result =
        call.result === "answered_normally"
          ? "Answered"
          : call.result === "no_answer"
            ? "No Answer"
            : call.result === "voicemail"
              ? "Went to Voicemail"
              : call.result === "busy"
                ? "Busy"
                : call.result;
      const dur = call.duration > 0 ? ` (${formatDuration(call.duration)})` : "";
      lines.push(
        `  • ${formatShortDate(call.startTime)} — ${dir} — ${result}${dur}`,
      );
    }
    if (calls.length > 10) {
      lines.push(`  … and ${calls.length - 10} older calls`);
    }
  }

  if (voicemails.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("VOICEMAILS:");
    for (const vm of voicemails) {
      const dur = vm.duration > 0 ? ` (${formatDuration(vm.duration)})` : "";
      const heard = vm.heard ? "Heard" : "Unheard";
      lines.push(`  • ${formatShortDate(vm.received)} — ${heard}${dur}`);
      if (vm.transcription) {
        // Truncate long transcriptions for the prompt context window
        const text =
          vm.transcription.length > 300
            ? vm.transcription.slice(0, 300) + "…"
            : vm.transcription;
        lines.push(`    Transcription: "${text}"`);
      }
    }
  }

  return lines.join("\n");
}

// ─── Org-wide user listing (Performance Dashboard) ───────────────────────────

export interface GoToOrgUser {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  /** Internal PBX extension number, e.g. "907" */
  extension?: string;
}

/**
 * DEBUG: Fetches a single user via SCIM API to see full schema.
 * Useful for discovering available fields and enterprise extensions.
 */
export async function fetchGoToScimUser(
  adminToken: string,
  userKey: string,
): Promise<any> {
  try {
    const url = `https://api.getgo.com/identity/v1/Users/${userKey}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Accept: "application/scim+json",
      },
    });

    if (!resp.ok) {
      console.error("[GotoUtils] SCIM Get User failed:", resp.status, await resp.text());
      return null;
    }

    const user = await resp.json();
    console.log("[GotoUtils] ✅ SCIM User Schema:", JSON.stringify(user, null, 2));
    return user;
  } catch (err) {
    console.error("[GotoUtils] fetchGoToScimUser error:", err);
    return null;
  }
}

/**
 * Fetches all users in the GoTo organization using the admin token.
 * PRIMARY: Tries SCIM API first (modern identity: scope standard)
 * FALLBACK: IAM Admin API if SCIM unavailable
 */
export async function fetchGoToOrgUsers(
  adminToken: string,
  numericAccountKey: string,
): Promise<GoToOrgUser[]> {
  const all: GoToOrgUser[] = [];

  try {
    // Use the legacy GoTo admin REST API — this returns the platform `key` (userKey) that is
    // compatible with call-history/v1, voice-admin, and all other GoTo platform APIs.
    // The IAM Admin API (iam.servers.getgo.com) and SCIM return different ID formats.
    // lookupGotoUserKeyByEmail() uses this same endpoint and is confirmed working.
    console.log("[GotoUtils] Fetching users via legacy admin REST API...");

    let offset = 0;
    const pageSize = 200;

    while (true) {
      const url = new URL(`https://api.getgo.com/admin/rest/v1/accounts/${numericAccountKey}/users`);
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("offset", String(offset));

      const resp = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("[GotoUtils] Legacy admin REST API failed:", resp.status, errorText);
        break;
      }

      const data = await resp.json();
      const results: any[] = data?.results ?? data?.users ?? data?.items ?? [];

      if (all.length === 0 && results.length > 0) {
        const s = results[0];
        console.log("[GotoUtils] Sample user:", { key: s.key, email: s.email, status: s.status, products: s.products });
      }

      for (const u of results) {
        all.push({
          key: String(u.key ?? u.userKey ?? u.id ?? ""),
          firstName: u.firstName ?? u.first_name ?? "",
          lastName: u.lastName ?? u.last_name ?? "",
          email: u.email ?? "",
          status: u.status ?? "ACTIVE",
          extension: u.extension ?? u.settings?.JIVE?.primaryExtensionNumber ?? undefined,
        });
      }

      if (results.length < pageSize) break;
      offset += pageSize;
    }

    console.log(`[GotoUtils] ✅ Legacy admin REST API returned ${all.length} users`);
    return all;
  } catch (err) {
    console.error("[GotoUtils] fetchGoToOrgUsers error:", err);
  }

  console.log(`[GotoUtils] fetchGoToOrgUsers returned ${all.length} users`);
  return all;
}

/**
 * Returns the numeric account key for the admin GoTo connection.
 * Falls back to fetching it live from legacy /me if not stored yet.
 */
export async function getAdminNumericAccountKey(adminToken: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("goto_connections")
    .select("numeric_account_key")
    .eq("is_admin_token", true)
    .maybeSingle();

  if (conn?.numeric_account_key) return conn.numeric_account_key;

  // Helper to cache and return a found key
  const cacheAndReturn = async (key: string): Promise<string> => {
    await supabase
      .from("goto_connections")
      .update({ numeric_account_key: key })
      .eq("is_admin_token", true);
    return key;
  };

  // Attempt 1: Check JWT claims for any numeric account identifier
  const jwtPayload = decodeGoToJwt(adminToken);
  if (jwtPayload) {
    const candidates = [
      jwtPayload["acct"],
      jwtPayload["accountId"],
      jwtPayload["aid"],
      jwtPayload["account_id"],
    ] as (unknown)[];
    for (const c of candidates) {
      if (c && /^\d+$/.test(String(c))) {
        console.log(`[GotoUtils] getAdminNumericAccountKey: found numeric key in JWT claim: ${String(c)}`);
        return cacheAndReturn(String(c));
      }
    }
  }

  // Attempt 2: Legacy /admin/rest/v1/me (requires identity: scope / Admin Center)
  try {
    const resp = await fetch("https://api.getgo.com/admin/rest/v1/me", {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
    });
    if (resp.ok) {
      const data = await resp.json();
      const numericKey = data?.accountKey ? String(data.accountKey) : null;
      if (numericKey) return cacheAndReturn(numericKey);
    } else {
      const errBody = await resp.text().catch(() => "");
      console.error(
        `[GotoUtils] getAdminNumericAccountKey: /admin/rest/v1/me returned HTTP ${resp.status}. ` +
        `This typically means the admin token lacks the 'identity:' scope (Admin Center must be ` +
        `enabled on the GoTo OAuth app at developer.goto.com, then re-auth via /api/goto/auth?admin=true). ` +
        `Body: ${errBody.slice(0, 300)}`,
      );
    }
  } catch (err) {
    console.error("[GotoUtils] getAdminNumericAccountKey: /admin/rest/v1/me fetch threw:", err);
  }

  // Attempt 3: /admin/v1/accounts — newer endpoint, may not need identity: scope
  // Check all returned fields for any integer-like key (GoTo sometimes returns legacyAccountKey).
  try {
    const resp = await fetch("https://api.goto.com/admin/v1/accounts", {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
    });
    if (resp.ok) {
      const data = await resp.json();
      const accounts: Record<string, unknown>[] = data?.results ?? data?.accounts ?? [];
      if (accounts.length > 0) {
        console.log("[GotoUtils] /admin/v1/accounts sample account fields:", JSON.stringify(accounts[0]));
        const acct = accounts[0];
        // Look for any integer-valued field that could be the legacy numeric account key
        const numericCandidate = (
          acct["legacyAccountKey"] ??
          acct["accountId"] ??
          acct["numericId"] ??
          acct["legacyId"]
        ) as string | number | undefined;
        if (numericCandidate && /^\d+$/.test(String(numericCandidate))) {
          console.log(`[GotoUtils] getAdminNumericAccountKey: found key via /admin/v1/accounts: ${numericCandidate}`);
          return cacheAndReturn(String(numericCandidate));
        }
        // Log all field values so we can find the right one if none matched above
        console.log("[GotoUtils] /admin/v1/accounts numeric-candidate fields:", {
          legacyAccountKey: acct["legacyAccountKey"],
          accountId: acct["accountId"],
          numericId: acct["numericId"],
          legacyId: acct["legacyId"],
          id: acct["id"],
          key: acct["key"],
        });
      }
    } else {
      const errBody = await resp.text().catch(() => "");
      console.error(`[GotoUtils] getAdminNumericAccountKey: /admin/v1/accounts returned HTTP ${resp.status}. Body: ${errBody.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[GotoUtils] getAdminNumericAccountKey: /admin/v1/accounts fetch threw:", err);
  }

  console.error(
    "[GotoUtils] getAdminNumericAccountKey: all attempts failed. " +
    "Admin must re-authorize GoTo via /api/goto/auth?admin=true after ensuring 'Admin Center' is " +
    "enabled on the GoTo OAuth app at developer.goto.com.",
  );
  return null;
}

/**
 * Fetches all org-wide call records using the numeric accountKey.
 * Paginates until all records within the date range are fetched.
 */
export interface GoToOrgCallRecord {
  legId: string;
  originatorId: string;
  caller: { name?: string; number: string };
  callee: { name?: string; number: string };
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL" | string;
  startTime: string;
  duration: number; // seconds
  hangupCause: number;
  /** DID of the GoTo user who owns this call leg */
  ownerPhoneNumber: string;
}

/**
 * Fetches call history for ALL users in the organization by iterating through each user.
 * This is necessary because the accountKey-scoped endpoint still filters to the authenticated user.
 * Returns org-wide calls by querying /users/{userKey}/calls for each user.
 */
export async function fetchGoToOrgCallsByUser(
  adminToken: string,
  users: GoToOrgUser[],
  lookbackDays = 14,
): Promise<GoToOrgCallRecord[]> {
  const all: GoToOrgCallRecord[] = [];
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  console.log(`[GotoUtils] Fetching calls for ${users.length} users (admin per-user iteration)...`);

  // Fetch calls for each user in parallel (in batches to avoid rate limits)
  const BATCH_SIZE = 10;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (user) => {
        try {
          const url = new URL(`https://api.goto.com/call-history/v1/users/${user.key}/calls`);
          url.searchParams.set("startTime", startTime);
          url.searchParams.set("endTime", endTime);
          url.searchParams.set("pageSize", "1000");

          const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
          });

          if (!resp.ok) {
            const errorText = await resp.text();
            if (resp.status === 403) {
              console.error(`[GotoUtils] ❌ PERMISSION DENIED for user ${user.email}: ${resp.status} - Admin token lacks call-history access for other users`);
            } else if (resp.status !== 404) {
              console.warn(`[GotoUtils] Failed to fetch calls for user ${user.email}: ${resp.status} - ${errorText.slice(0, 100)}`);
            }
            return [];
          }

          const data = await resp.json();
          const items: GoToOrgCallRecord[] = data?.items ?? [];

          if (items.length > 0) {
            console.log(`[GotoUtils] ✅ User ${user.firstName} ${user.lastName} (${user.email}): ${items.length} calls`);
          }

          return items;
        } catch (err) {
          console.error(`[GotoUtils] Error fetching calls for user ${user.email}:`, err);
          return [];
        }
      })
    );

    for (const calls of batchResults) {
      all.push(...calls);
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[GotoUtils] fetchGoToOrgCallsByUser completed: ${all.length} total calls from ${users.length} users`);
  return all;
}

/**
 * Fetches org-wide call history using the accountKey parameter.
 * NOTE: This may still be user-scoped depending on GoTo plan/permissions.
 * Use fetchGoToOrgCallsByUser() for true org-wide coverage.
 */
export async function fetchGoToOrgCalls(
  adminToken: string,
  numericAccountKey: string,
  lookbackDays = 14,
): Promise<GoToOrgCallRecord[]> {
  const all: GoToOrgCallRecord[] = [];
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();
  let pageMarker: string | null = null;

  try {
    while (true) {
      const url = new URL("https://api.goto.com/call-history/v1/calls");
      url.searchParams.set("accountKey", numericAccountKey);
      url.searchParams.set("startTime", startTime);
      url.searchParams.set("endTime", endTime);
      url.searchParams.set("pageSize", "1000");
      if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      if (!resp.ok) {
        console.warn("[GotoUtils] fetchGoToOrgCalls failed:", resp.status);
        break;
      }

      const data = await resp.json();
      const items: GoToOrgCallRecord[] = data?.items ?? [];

      // Log first call to see ALL available fields
      if (all.length === 0 && items.length > 0) {
        console.log("[GotoUtils] Sample call-history record (full):", JSON.stringify(items[0], null, 2));
      }

      all.push(...items);

      pageMarker = data?.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
    }
  } catch (err) {
    console.error("[GotoUtils] fetchGoToOrgCalls error:", err);
  }

  return all;
}

// ─── Call Queue helpers ───────────────────────────────────────────────────────

export interface GoToCallQueue {
  id: string;
  name: string;
  description?: string;
  extensionNumber?: string;
}

/**
 * Fetches all call queues in the org using voice-admin.v1.read scope.
 * Uses the numeric accountKey.
 */
export async function fetchGoToCallQueues(
  adminToken: string,
  numericAccountKey: string,
): Promise<GoToCallQueue[]> {
  const all: GoToCallQueue[] = [];
  let pageMarker: string | null = null;

  try {
    while (true) {
      const url = new URL("https://api.goto.com/voice-admin/v1/call-queues");
      url.searchParams.set("accountKey", numericAccountKey);
      url.searchParams.set("pageSize", "100");
      if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      if (!resp.ok) {
        console.warn("[GotoUtils] fetchGoToCallQueues failed:", resp.status, await resp.text());
        break;
      }

      const data = await resp.json();
      const items = data?.items ?? [];

      for (const q of items) {
        all.push({
          id: String(q.id ?? q.key ?? ""),
          name: q.name ?? q.displayName ?? "",
          description: q.description ?? undefined,
          extensionNumber: q.extensionNumber ?? q.extension ?? undefined,
        });
      }

      pageMarker = data?.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
    }
  } catch (err) {
    console.error("[GotoUtils] fetchGoToCallQueues error:", err);
  }

  return all;
}

// ─── Org phone lines (DID → user attribution) ────────────────────────────────

export interface GoToOrgLine {
  /** The phone number / DID e.g. "+19549001234" */
  number: string;
  /** GoTo user key of the line owner (if assigned) */
  userKey: string | null;
  name?: string;
}

/**
 * Fetches all phone lines in the org using voice-admin.v1.read scope.
 * Enables accurate attribution of external call legs by ownerPhoneNumber
 * without relying on internal-call seeding.
 */
export async function fetchGoToOrgLines(
  adminToken: string,
  numericAccountKey: string,
): Promise<GoToOrgLine[]> {
  const all: GoToOrgLine[] = [];
  let pageMarker: string | null = null;

  try {
    // Try IAM Admin API first (same domain as users endpoint that worked)
    const iamUrl = `https://iam.servers.getgo.com/ext-admin/rest/accounts/${numericAccountKey}/lines`;
    const iamResp = await fetch(iamUrl, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
    });

    if (iamResp.ok) {
      const data = await iamResp.json();
      console.log("[GotoUtils] IAM Lines API response keys:", Object.keys(data));
      const lines = data?.lines ?? data?.items ?? data?.results ?? [];
      if (lines.length > 0) {
        console.log("[GotoUtils] Sample IAM line structure:", JSON.stringify(lines[0], null, 2));
      }
      for (const line of lines) {
        const number = line.number ?? line.phoneNumber ?? line.did ?? "";
        const userKey = line.userKey ?? line.assignedUserKey ?? line.userId ?? null;
        if (number) {
          all.push({ number: String(number), userKey: userKey ? String(userKey) : null, name: line.name });
        }
      }
      console.log(`[GotoUtils] fetchGoToOrgLines (IAM API) returned ${all.length} lines`);
      return all;
    } else {
      console.warn("[GotoUtils] IAM Lines API failed:", iamResp.status);
    }

    // Fallback to standard voice-admin API
    while (true) {
      const url = new URL("https://api.goto.com/voice-admin/v1/lines");
      url.searchParams.set("accountKey", numericAccountKey);
      url.searchParams.set("pageSize", "500");
      if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      if (!resp.ok) {
        console.warn("[GotoUtils] fetchGoToOrgLines (standard API) failed:", resp.status);
        break;
      }

      const data = await resp.json();
      const items = data?.items ?? [];

      for (const line of items) {
        const number = line.number ?? line.phoneNumber ?? line.did ?? "";
        const userKey = line.userKey ?? line.assignedUserKey ?? line.userId ?? null;
        if (number) {
          all.push({ number: String(number), userKey: userKey ? String(userKey) : null, name: line.name });
        }
      }

      pageMarker = data?.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
    }
  } catch (err) {
    console.error("[GotoUtils] fetchGoToOrgLines error:", err);
  }

  return all;
}

// ─── Queue-caller analytics (requires queue-caller.v1.read scope) ────────────

/** A single call record from the GoTo queue-caller analytics API */
export interface GoToQueueCallerRecord {
  legId: string;           // conversationSpaceIds[0] — NOT the recording ID
  callerLegId?: string;    // caller.legId from raw API — potential recording ID candidate
  startTime: string;
  queueName: string;
  callerName: string;
  callerNumber: string;
  dialedNumber?: string;
  agentName: string;         // "Josh Stein (on 249ad8a...)" — use extractAgentDisplayName()
  talkDurationSeconds: number;
  callDurationSeconds: number;
  waitTimeSeconds: number;
  outcome: string;           // "handled" | "evicted system" | etc.
  leftQueueReason: string;   // "answered" | "queue timeout" | etc.
  direction: string;
  aiSentiment: string;       // "POSITIVE" | "NEUTRAL" | "NEGATIVE" | ""
  topics: string[];
  meetsSla: boolean;
  agentRingTimeSeconds: number;
}

/**
 * Extracts the clean display name from a GoTo agent name like:
 * "Josh Stein (on 249ad8a3fd02)" → "Josh Stein"
 * "Dameon McDonald (on Dameon McDonald)" → "Dameon McDonald"
 */
export function extractAgentDisplayName(rawAgentName: string): string {
  return rawAgentName.replace(/\s*\(on\s+[^)]+\)\s*$/, "").trim();
}

/** Result of fetchGoToQueueCallerCalls */
export type QueueCallerResult =
  | { calls: GoToQueueCallerRecord[]; nextPageMarker: string | null; scopeMissing: false; tokenExpired: false; rateLimited: false; apiUnavailable: false }
  | { calls: null; scopeMissing: true; tokenExpired: false; rateLimited: false; apiUnavailable: false }  // 403 — scope/license missing
  | { calls: null; scopeMissing: false; tokenExpired: true; rateLimited: false; apiUnavailable: false }  // 401 — token expired/revoked
  | { calls: null; scopeMissing: false; tokenExpired: false; rateLimited: true; apiUnavailable: false }  // 429 — rate limited
  | { calls: null; scopeMissing: false; tokenExpired: false; rateLimited: false; apiUnavailable: true };  // 404 — plan limitation

/**
 * Fetches queue-caller analytics records (requires queue-caller.v1.read scope).
 * Returns a typed result distinguishing:
 *   - scopeMissing: token lacks the scope → user must re-auth
 *   - apiUnavailable: scope present but endpoint returns 404 → GoTo plan limitation
 *   - calls: successful fetch
 */
export async function fetchGoToQueueCallerCalls(
  adminToken: string,
  numericAccountKey: string,
  lookbackDays = 14,
  queueNames?: string[],
  startPageMarker?: string,
  maxRecords = 500,
): Promise<QueueCallerResult> {
  const all: GoToQueueCallerRecord[] = [];
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();
  let pageMarker: string | null = startPageMarker ?? null;
  let retryCount = 0;

  // Confirmed working endpoint (POST, body params, requires Contact Center Complete license)
  const endpoint = `https://api.goto.com/contact-center-analytics/v1/accounts/${numericAccountKey}/queue-caller-details`;

  try {
    while (true) {
      const pageSize = Math.min(500, maxRecords - all.length);
      const body: Record<string, unknown> = {
        startTime,
        endTime,
        pageSize,
      };
      if (pageMarker) body.pageMarker = pageMarker;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 429) {
        const retryAfter = Number(resp.headers.get("Retry-After") ?? 0);
        // Cap at 10s — Netlify serverless functions time out at 26s and GoTo often
        // returns Retry-After: 60. If we'd need to wait longer than 10s, fail fast
        // so the caller can surface a "try again" message rather than timing out.
        const backoffMs = Math.min(
          retryAfter > 0 ? retryAfter * 1000 : [2000, 4000, 8000][retryCount] ?? 8000,
          10000,
        );
        if (retryCount < 3) {
          console.warn(`[GotoUtils] queue-caller-details 429 — rate limited, retry ${retryCount + 1}/3 in ${backoffMs}ms`);
          await new Promise((r) => setTimeout(r, backoffMs));
          retryCount++;
          continue; // retry the same page
        }
        console.warn("[GotoUtils] queue-caller-details 429 — rate limited, exhausted retries");
        return { calls: null, scopeMissing: false, tokenExpired: false, rateLimited: true, apiUnavailable: false };
      }

      retryCount = 0; // reset on a successful response

      if (resp.status === 401) {
        const errBody = await resp.text().catch(() => "");
        console.warn(`[GotoUtils] queue-caller-details 401 — token expired or revoked. Body: ${errBody}`);
        return { calls: null, scopeMissing: false, tokenExpired: true, rateLimited: false, apiUnavailable: false };
      }

      if (resp.status === 403) {
        const errBody = await resp.text().catch(() => "");
        console.warn(`[GotoUtils] queue-caller-details 403 — scope or license missing. Body: ${errBody}`);
        return { calls: null, scopeMissing: true, tokenExpired: false, rateLimited: false, apiUnavailable: false };
      }

      if (resp.status === 404) {
        console.error("[GotoUtils] queue-caller-details 404 — Contact Center Complete license not active on account");
        return { calls: null, scopeMissing: false, tokenExpired: false, rateLimited: false, apiUnavailable: true };
      }

      if (!resp.ok) {
        console.warn("[GotoUtils] queue-caller-details fetch failed:", resp.status);
        return { calls: null, scopeMissing: false, tokenExpired: false, rateLimited: false, apiUnavailable: true };
      }

      const data = await resp.json();
      const items: unknown[] = data?.items ?? [];

      console.log(`[GotoUtils] queue-caller-details page: ${items.length} items, hasMore=${!!data?.nextPageMarker}`);

      // On the first page, log the raw API fields from the first HANDLED item so we can
      // discover any recordingId / transcriptId fields GoTo returns that we aren't mapping yet.
      if (all.length === 0 && items.length > 0) {
        const firstHandled = (items as Record<string, unknown>[]).find(
          i => String(i.outcome ?? "").toLowerCase() === "handled"
        );
        if (firstHandled) {
          console.log("[GotoUtils] RAW queue-caller item (first HANDLED across ALL agents — diagnostic only, not filtered yet):", JSON.stringify(firstHandled, null, 2));
        }
      }

      for (const item of items as Record<string, unknown>[]) {
        // API returns caller-perspective queue records (NO agentName — use agent-details endpoint for per-agent stats).
        // queue and caller fields may be nested objects: { name, id } / { number, name }
        const extractStr = (raw: unknown, fallback = ""): string => {
          if (!raw) return fallback;
          if (typeof raw === "string") return raw;
          if (typeof raw === "object") {
            const o = raw as Record<string, unknown>;
            return String(o.name ?? o.displayName ?? o.number ?? o.id ?? fallback);
          }
          return String(raw);
        };

        // Extract callerLegId from nested caller object: { legId, name, number }
        const callerObj = item.caller as Record<string, unknown> | undefined;
        const callerLegId = callerObj?.legId ? String(callerObj.legId) : undefined;

        all.push({
          legId: String((item.conversationSpaceIds as string[])?.[0] ?? item.startTime ?? ""),
          callerLegId,
          startTime: String(item.startTime ?? ""),
          queueName: extractStr(item.queue ?? item.queueName, String(item.diledNumberName ?? item.dialedNumberName ?? "")),
          callerName: extractStr(item.caller ?? item.callerName, ""),
          callerNumber: extractStr(item.callerNumber ?? (item.caller as Record<string, unknown>)?.number, String(item.diledNumber ?? item.dialedNumber ?? "")),
          dialedNumber: item.diledNumber !== undefined ? String(item.diledNumber) : item.dialedNumber !== undefined ? String(item.dialedNumber) : undefined,
          agentName: extractStr(item.agent ?? item.agentName ?? item.agentDisplayName, ""),
          talkDurationSeconds: Number(item.talkDuration ?? item.talkDurationSeconds ?? 0),
          callDurationSeconds: Number(item.duration ?? item.callDurationSeconds ?? 0),
          waitTimeSeconds: Number(item.waitTime ?? item.waitTimeSeconds ?? 0),
          outcome: String(item.outcome ?? ""),
          leftQueueReason: String(item.leInQueueReason ?? item.leftQueueReason ?? ""),
          direction: String(item.direction ?? "INBOUND"),
          aiSentiment: String(item.aiSentiment ?? item.ai_sentiment ?? "").toUpperCase(),
          topics: Array.isArray(item.topics)
            ? (item.topics as string[])
            : typeof item.topics === "string"
              ? (item.topics as string).split(",").map((t) => t.trim()).filter(Boolean)
              : [],
          meetsSla: item.metServiceLevel === "YES",
          agentRingTimeSeconds: Number(item.agentRingTime ?? item.agentRingTimeSeconds ?? 0),
        });
      }

      pageMarker = data?.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
      // Stop fetching once we hit the record cap — return the marker so the caller can continue
      if (all.length >= maxRecords) break;
    }
  } catch (err) {
    console.error("[GotoUtils] fetchGoToQueueCallerCalls error:", err);
    return { calls: null, scopeMissing: false, tokenExpired: false, rateLimited: false, apiUnavailable: true };
  }

  // Filter by queue name if requested
  let filtered = all;
  if (queueNames && queueNames.length > 0) {
    const filterSet = new Set(queueNames.map((n) => n.toLowerCase()));
    filtered = all.filter((r) => filterSet.has(r.queueName.toLowerCase()));
  }

  // Only expose the nextPageMarker if we stopped early (more data available)
  const returnedMarker = all.length >= maxRecords ? (pageMarker ?? null) : null;
  console.log(`[GotoUtils] queue-caller-details: ${all.length} records fetched (cap=${maxRecords}), nextPageMarker=${returnedMarker ?? "none"}`);
  return { calls: filtered, nextPageMarker: returnedMarker, scopeMissing: false, tokenExpired: false, rateLimited: false, apiUnavailable: false };
}

// ─── Call Recording & Transcription ───────────────────────────────────────────

export interface GoToRecording {
  id: string;
  callLegId: string;
  startTime: string;
  duration: number;
  direction: "INBOUND" | "OUTBOUND";
  caller: { name?: string; number: string };
  callee: { name?: string; number: string };
  hasTranscript: boolean;
  transcript?: string; // Populated by enrichRecordingTranscripts()
  transcriptionId?: string; // GoTo transcription ID for /recording/v1/transcriptions/{id}
}

/**
 * Fetch call recordings for the authenticated user (self-scoped endpoint).
 * Only returns calls with recordings available (not all calls are recorded).
 * 
 * @param token - GoTo access token
 * @param phoneNumbers - Optional filter to specific phone numbers
 * @param daysBack - How many days to look back (max 90)
 * @returns Array of recording metadata (transcripts fetched separately)
 */
export async function fetchGoToRecordings(
  token: string,
  phoneNumbers?: string[],
  daysBack: number = 30,
): Promise<GoToRecording[]> {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - Math.min(daysBack, 90));
  const endTime = new Date();

  const recordings: GoToRecording[] = [];
  let pageMarker: string | null = null;

  try {
    while (true) {
      const url = new URL("https://api.goto.com/recording/v1/recordings");
      url.searchParams.set("startTime", startTime.toISOString());
      url.searchParams.set("endTime", endTime.toISOString());
      url.searchParams.set("pageSize", "100");
      if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!response.ok) {
        console.error(`[GotoUtils] fetchGoToRecordings failed: ${response.status}`);
        break;
      }

      const data = await response.json();
      const items = data.items ?? [];

      for (const item of items) {
        // Filter by phone numbers if provided
        if (phoneNumbers && phoneNumbers.length > 0) {
          const callerMatch = phoneNumbers.some(p => item.caller?.number?.includes(p));
          const calleeMatch = phoneNumbers.some(p => item.callee?.number?.includes(p));
          if (!callerMatch && !calleeMatch) continue;
        }

        recordings.push({
          id: item.id,
          callLegId: item.callLegId ?? item.call_leg_id ?? "",
          startTime: item.startTime ?? item.start_time,
          duration: Number(item.duration ?? 0),
          direction: item.direction?.toUpperCase() === "INBOUND" ? "INBOUND" : "OUTBOUND",
          caller: {
            name: item.caller?.name,
            number: item.caller?.number ?? "",
          },
          callee: {
            name: item.callee?.name,
            number: item.callee?.number ?? "",
          },
          hasTranscript: Boolean(item.hasTranscript ?? item.has_transcript),
        });
      }

      pageMarker = data.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
    }
  } catch (err) {
    console.error("[GotoUtils] fetchGoToRecordings error:", err);
  }

  return recordings;
}

/**
 * Search call recordings across the entire org by phone number and explicit date range.
 *
 * Differs from {@link fetchGoToRecordings}:
 *   - Takes explicit start/end ISO strings (not a lookback days count)
 *   - Phone match uses digit normalization (handles +1, dashes, parens, etc.)
 *   - Always uses the admin token (returns recordings for any org user)
 *
 * @param adminToken   GoTo admin access token (recording.v1.read scope)
 * @param phoneDigits  Normalized digits-only phone fragment (e.g. "9548264318"). Pass "" to skip phone filter.
 * @param startTimeIso ISO start time (inclusive)
 * @param endTimeIso   ISO end time (inclusive)
 * @param maxRecords   Safety cap on returned recordings (default 200)
 */
export async function searchGoToRecordingsByPhone(
  adminToken: string,
  phoneDigits: string,
  startTimeIso: string,
  endTimeIso: string,
  maxRecords: number = 200,
): Promise<GoToRecording[]> {
  const recordings: GoToRecording[] = [];
  let pageMarker: string | null = null;
  const target = phoneDigits.replace(/\D/g, "");

  try {
    while (recordings.length < maxRecords) {
      const url = new URL("https://api.goto.com/recording/v1/recordings");
      url.searchParams.set("startTime", startTimeIso);
      url.searchParams.set("endTime", endTimeIso);
      url.searchParams.set("pageSize", "100");
      if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      if (!response.ok) {
        console.error(`[GotoUtils] searchGoToRecordingsByPhone failed: ${response.status}`);
        break;
      }

      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = data.items ?? [];

      for (const item of items) {
        if (target) {
          const callerDigits = String(item.caller?.number ?? "").replace(/\D/g, "");
          const calleeDigits = String(item.callee?.number ?? "").replace(/\D/g, "");
          const hit = callerDigits.includes(target) || calleeDigits.includes(target)
            || target.includes(callerDigits) || target.includes(calleeDigits);
          if (!hit) continue;
        }

        const recordingId = String(item.id ?? "");
        const transcriptionId = item.transcriptionId ? String(item.transcriptionId) : (item.hasTranscript ? recordingId : undefined);

        recordings.push({
          id: recordingId,
          callLegId: String(item.callLegId ?? item.call_leg_id ?? ""),
          startTime: String(item.startTime ?? item.start_time ?? ""),
          duration: Number(item.duration ?? 0),
          direction: String(item.direction ?? "").toUpperCase() === "INBOUND" ? "INBOUND" : "OUTBOUND",
          caller: {
            name: item.caller?.name,
            number: String(item.caller?.number ?? ""),
          },
          callee: {
            name: item.callee?.name,
            number: String(item.callee?.number ?? ""),
          },
          hasTranscript: Boolean(item.hasTranscript ?? item.has_transcript ?? transcriptionId),
          transcriptionId,
        });

        if (recordings.length >= maxRecords) break;
      }

      pageMarker = data.nextPageMarker ?? null;
      if (!pageMarker || items.length === 0) break;
    }
  } catch (err) {
    console.error("[GotoUtils] searchGoToRecordingsByPhone error:", err);
  }

  return recordings;
}

/**
 * Fetch call recordings for a specific user (admin proxy).
 *
 * GoTo's recording API has no listing endpoint — the only way to discover
 * recording IDs is through the call-history API where each answered call
 * may include a `recording` object with `id` and `transcriptionId`.
 *
 * @param token - Admin GoTo access token
 * @param userKey - GoTo user key to fetch recordings for
 * @param phoneNumbers - Optional filter to specific phone numbers
 * @param daysBack - How many days to look back (max 90)
 */
export async function fetchGoToRecordingsForUser(
  token: string,
  userKey: string,
  phoneNumbers?: string[],
  daysBack: number = 30,
): Promise<{ recordings: GoToRecording[]; recordingApiBlocked: boolean }> {
  // Recording IDs come from the call-history API — there is no listing endpoint.
  // Note: admin proxy access to /call-history/v1/users/{key}/calls may return 404 for some users.
  // In that case, use fetchGoToRecordingsViaQueueCaller() as fallback in the caller.
  // The /recording/v1/subscriptions probe was intentionally REMOVED — that endpoint requires
  // recording.v1.notifications.manage scope, not recording.v1.read. Always set false.
  const recordingApiBlocked = false;

  const allCalls = await fetchGoToCallHistoryForUser(token, userKey, phoneNumbers ?? [], daysBack);
  console.log(`[GotoUtils] call-history for userKey=${userKey}: ${allCalls.length} total calls`);

  if (allCalls.length === 0) {
    return { recordings: [], recordingApiBlocked };
  }

  if (allCalls.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstCall = allCalls[0] as any;
    console.log("[GotoUtils] First call-history record keys:", Object.keys(firstCall));
    console.log("[GotoUtils] First call-history record:", JSON.stringify(firstCall, null, 2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withRecording = (allCalls as any[]).filter(
      (c) => c.recording?.id || c.recording?.transcriptionId || c.transcriptEnabled
    );
    console.log(`[GotoUtils] Calls with recording/transcript: ${withRecording.length} / ${allCalls.length}`);
    if (withRecording.length > 0) {
      console.log("[GotoUtils] First call with recording:", JSON.stringify(withRecording[0], null, 2));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordings = (allCalls as any[]).flatMap((call) => {
    const rec = call.recording as Record<string, unknown> | undefined;

    // Per GoTo docs, if transcriptEnabled=true the recording ID is also the transcript ID
    const recordingId = (rec?.id ?? null) as string | null;
    const transcriptEnabled = Boolean(call.transcriptEnabled);
    const transcriptionId = (rec?.transcriptionId ?? (transcriptEnabled && recordingId ? recordingId : null)) as string | null;

    if (!recordingId && !transcriptionId) return [];

    return [{
      id: (recordingId ?? transcriptionId ?? call.id) as string,
      callLegId: call.id as string,
      startTime: call.startTime as string,
      duration: Number(call.duration ?? 0),
      direction: (String(call.direction ?? "").toUpperCase() === "INBOUND" ? "INBOUND" : "OUTBOUND") as "INBOUND" | "OUTBOUND",
      caller: call.caller as { name?: string; number: string },
      callee: call.callee as { name?: string; number: string },
      hasTranscript: Boolean(rec?.hasTranscription ?? transcriptionId),
      transcriptionId: transcriptionId ?? undefined,
    }];
  });

  return { recordings, recordingApiBlocked };
}

/**
 * Alternative recording discovery via queue-caller analytics.
 * Used when /call-history/v1/users/{key}/calls returns 404 (admin proxy not supported).
 *
 * Uses the queue-caller API to find call legIds for the target agent, then tries
 * GET /recording/v1/transcriptions/{legId} for each eligible HANDLED call.
 * Per GoTo docs: "If the field transcriptEnabled is true, the same id can be used
 * to fetch a transcript." The legId (conversationSpaceId) is the recording/transcript ID.
 *
 * Returns recordings with transcripts already embedded — no need to call
 * enrichRecordingTranscripts() separately on the returned array.
 */
export async function fetchGoToRecordingsViaQueueCaller(
  adminToken: string,
  numericAccountKey: string,
  orgUsers: GoToOrgUser[],
  targetUserKey: string,
  daysBack: number = 14,
  minDurationSeconds: number = 60,
  maxCalls: number = 20,
): Promise<GoToRecording[]> {
  // Find the agent's display name from org users
  const targetUser = orgUsers.find(u => u.key === targetUserKey);
  if (!targetUser) {
    console.warn(`[GotoUtils] fetchGoToRecordingsViaQueueCaller: no org user found for userKey=${targetUserKey}`);
    return [];
  }
  const displayName = `${targetUser.firstName} ${targetUser.lastName}`.trim();
  console.log(`[GotoUtils] Queue-caller recording fallback for ${displayName} (key=${targetUserKey})`);

  // Fetch ALL queue-caller pages for the time window — needed because the company-wide
  // record stream is ordered by time, so an agent's calls could appear on any page.
  // With 84+ agents and 14 days, 2000 records is only a fraction of the full window.
  let allCalls: GoToQueueCallerRecord[] = [];
  let pageMarker: string | undefined = undefined;
  const PAGE_CAP = 20; // safety limit: 20 × 2000 = up to 40,000 company-wide records
  for (let page = 0; page < PAGE_CAP; page++) {
    const result = await fetchGoToQueueCallerCalls(adminToken, numericAccountKey, daysBack, undefined, pageMarker, 2000);
    if (result.calls === null) {
      console.warn(`[GotoUtils] Queue-caller fetch failed in recording fallback (page ${page + 1})`);
      break;
    }
    allCalls = allCalls.concat(result.calls);
    if (!result.nextPageMarker) break;
    pageMarker = result.nextPageMarker;
  }

  // Filter to this agent's HANDLED calls with sufficient talk time
  const agentCalls = allCalls.filter(r =>
    r.outcome.toUpperCase() === "HANDLED" &&
    r.talkDurationSeconds >= minDurationSeconds &&
    extractAgentDisplayName(r.agentName) === displayName,
  );

  // Take the most recent calls up to maxCalls
  const candidates = agentCalls
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, maxCalls);

  console.log(`[GotoUtils] ${displayName}: ${agentCalls.length} eligible calls → checking ${candidates.length} for transcripts`);

  const recordings: GoToRecording[] = [];

  for (const call of candidates) {
    // Two candidate IDs to try for the recording/transcript API:
    //   callerLegId  — caller.legId from the raw API (a proper call leg UUID)
    //   conversationSpaceId — conversationSpaceIds[0] (confirmed NOT a recording ID; returns 404)
    // Try callerLegId first, fall back to conversationSpaceId.
    const idCandidates: string[] = [];
    if (call.callerLegId && call.callerLegId.includes("-")) idCandidates.push(call.callerLegId);
    if (call.legId && call.legId.includes("-") && call.legId !== call.callerLegId) idCandidates.push(call.legId);

    if (idCandidates.length === 0) continue;

    for (const candidateId of idCandidates) {
      // Probe the recording content endpoint first to check if this ID is a valid recordingId.
      const recordingProbeUrl = `https://api.goto.com/recording/v1/recordings/${encodeURIComponent(candidateId)}/content`;
      const recordingProbe = await fetch(recordingProbeUrl, {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });
      console.log(`[GotoUtils] Recording probe id=${candidateId} (${candidateId === call.callerLegId ? "callerLegId" : "conversationSpaceId"}): HTTP ${recordingProbe.status}`);

      // Then try the transcript endpoint.
      const transcriptUrl = `https://api.goto.com/recording/v1/transcriptions/${encodeURIComponent(candidateId)}`;
      const transcriptResponse = await fetch(transcriptUrl, {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      if (transcriptResponse.ok) {
        const data = await transcriptResponse.json();
        const results: Array<{ transcript: string; channel: number; startTimeMs: number }> = data.results ?? [];
        const transcript = results.length > 0
          ? results
              .sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0))
              .map(r => `[${r.channel === 0 ? "Agent" : "Customer"}]: ${r.transcript ?? ""}`.trim())
              .filter(line => line.length > 10)
              .join("\n")
          : undefined;

        console.log(`[GotoUtils] Transcript found for id=${candidateId}: ${results.length} segments`);

        recordings.push({
          id: candidateId,
          callLegId: candidateId,
          startTime: call.startTime,
          duration: call.talkDurationSeconds,
          direction: call.direction.toUpperCase() === "INBOUND" ? "INBOUND" : "OUTBOUND",
          caller: { name: call.callerName || undefined, number: call.callerNumber || "" },
          callee: { name: undefined, number: call.dialedNumber || "" },
          hasTranscript: Boolean(transcript),
          transcript,
          transcriptionId: candidateId,
        });
        break; // Found a valid ID for this call — no need to try the other candidate
      } else {
        console.log(`[GotoUtils] No transcript for id=${candidateId}: HTTP ${transcriptResponse.status}`);
      }
    }
  }

  console.log(`[GotoUtils] Queue-caller fallback: ${recordings.length} / ${candidates.length} calls have transcripts`);
  return recordings;
}

/**
 * Discover call transcriptions via the call-reports user-activity API.
 *
 * This is the most reliable approach for fetching transcriptions for any agent
 * without requiring them to have a Salestrack CRM account.  The admin token
 * has the `cr.v1.read` scope which grants access to call-reports for all org users.
 *
 * Flow:
 *  1. GET /call-reports/v1/reports/user-activity?q={displayName}
 *     → find the agent's call-reports `userId` (different from GoTo identity userKey)
 *  2. GET /call-reports/v1/reports/user-activity/{userId}
 *     → get individual call legs with recordingId + transcriptEnabled fields
 *  3. For legs where transcriptEnabled=true, fetch /recording/v1/transcriptions/{recordingId}
 *
 * Returns recordings with transcripts already populated.
 * Also returns a `diagnostic` object with raw API samples for debugging.
 */
export async function fetchGoToTranscriptionsViaCallReports(
  adminToken: string,
  targetDisplayName: string,
  daysBack: number = 14,
  minDurationSeconds: number = 60,
  maxCalls: number = 10,
  options: { queueOnly?: boolean; directOnly?: boolean } = {},
): Promise<{ recordings: GoToRecording[]; diagnostic: Record<string, unknown> }> {
  const { queueOnly = false, directOnly = false } = options;
  const endTime = new Date();
  const startTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const diagnostic: Record<string, unknown> = { targetDisplayName, daysBack };

  // ── Step 1: Find the user's call-reports userId by fuzzy name search ─────────
  let callReportsUserId: string | null = null;
  {
    const url = new URL("https://api.goto.com/call-reports/v1/reports/user-activity");
    url.searchParams.set("startTime", startTime.toISOString());
    url.searchParams.set("endTime", endTime.toISOString());
    url.searchParams.set("pageSize", "100");
    // Use q= fuzzy search on userName to narrow results
    const nameParts = targetDisplayName.trim().split(/\s+/);
    if (nameParts[0]) url.searchParams.set("q", nameParts[0]);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
    });

    diagnostic.summaryStatus = resp.status;

    if (resp.ok) {
      const body = await resp.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = body.items ?? [];
      diagnostic.summaryCount = items.length;

      // Log first raw item so we can see all available fields
      if (items.length > 0) {
        diagnostic.summaryFirstRaw = items[0];
      }

      // Match by display name (case-insensitive)
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const target = norm(targetDisplayName);
      const matched = items.find((u) => norm(String(u.userName ?? "")) === target)
        ?? items.find((u) => norm(String(u.userName ?? "")).includes(norm(nameParts[0] ?? "")));

      if (matched) {
        callReportsUserId = String(matched.userId ?? "");
        diagnostic.matchedUser = { userId: callReportsUserId, userName: matched.userName };
        console.log(`[GotoUtils] Call-reports: matched "${targetDisplayName}" → userId=${callReportsUserId}`);
      } else {
        console.warn(`[GotoUtils] Call-reports: no match found for "${targetDisplayName}" in ${items.length} results`);
        diagnostic.noMatch = true;
        return { recordings: [], diagnostic };
      }
    } else {
      const errText = await resp.text().catch(() => "");
      diagnostic.summaryError = errText;
      console.error(`[GotoUtils] Call-reports summary failed: HTTP ${resp.status}`, errText);
      return { recordings: [], diagnostic };
    }
  }

  if (!callReportsUserId) return { recordings: [], diagnostic };

  // ── Step 2: Get per-call detail for this user ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allLegs: any[] = [];
  {
    let page = 0;
    const PAGE_CAP = 5; // max 5 pages × 100 = 500 calls
    while (page < PAGE_CAP) {
      const url = new URL(
        `https://api.goto.com/call-reports/v1/reports/user-activity/${encodeURIComponent(callReportsUserId)}`
      );
      url.searchParams.set("startTime", startTime.toISOString());
      url.searchParams.set("endTime", endTime.toISOString());
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("page", String(page));

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      diagnostic.detailStatus = resp.status;

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        diagnostic.detailError = errText;
        console.error(`[GotoUtils] Call-reports detail failed: HTTP ${resp.status}`);
        break;
      }

      const body = await resp.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = body.items ?? [];
      allLegs = allLegs.concat(items);

      // Log the raw structure of the first few records so we can see all field names
      if (page === 0 && items.length > 0) {
        diagnostic.detailFirstRaw = items[0];
        diagnostic.detailAllKeys = Object.keys(items[0]);
        console.log(`[GotoUtils] Call-reports detail page 0 — first record keys:`, Object.keys(items[0]));
        console.log(`[GotoUtils] Call-reports detail first record:`, JSON.stringify(items[0], null, 2));
      }

      // GoTo call-reports uses 0-based page param (not a cursor marker)
      if (items.length < 100) break;
      page++;
    }

    diagnostic.totalLegs = allLegs.length;
    console.log(`[GotoUtils] Call-reports detail: ${allLegs.length} call legs for userId=${callReportsUserId}`);
  }

  if (allLegs.length === 0) return { recordings: [], diagnostic };

  // ── Step 3: Find legs with recording/transcript fields ─────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withRecording = allLegs.filter((leg: any) => {
    const duration = Number(leg.duration ?? leg.talkDuration ?? 0);
    const hasRecId = Boolean(
      leg.recordingId ?? leg.recording?.id ?? leg.recordings?.[0]?.id ?? leg.recordingIds?.[0]
    );
    const hasTranscript = Boolean(
      leg.transcriptEnabled ?? leg.hasTranscription ?? leg.transcriptId ?? leg.recording?.transcriptionId
    );
    // Queue/direct filter — call-reports returns `queue: {...} | null` per leg.
    // Queue calls (inbound off a queue) have a non-null queue object; direct/outbound
    // calls have queue: null.
    if (queueOnly && !leg.queue) return false;
    if (directOnly && leg.queue) return false;
    return duration >= minDurationSeconds && (hasRecId || hasTranscript);
  });

  diagnostic.legsWithRecording = withRecording.length;
  if (withRecording.length > 0) {
    diagnostic.recordingSamples = withRecording.slice(0, 3);
    console.log(`[GotoUtils] Call-reports: ${withRecording.length} legs with recording/transcript data`);
    console.log(`[GotoUtils] First recording leg:`, JSON.stringify(withRecording[0], null, 2));
  } else {
    // Log a sample of legs without recording to help diagnose
    diagnostic.nonRecordingSamples = allLegs.slice(0, 3).map((l: Record<string, unknown>) => ({
      ...Object.fromEntries(
        Object.entries(l).filter(([k]) =>
          k.toLowerCase().includes("record") ||
          k.toLowerCase().includes("transcript") ||
          k.toLowerCase().includes("duration") ||
          k.toLowerCase().includes("id") ||
          k.toLowerCase().includes("answer")
        )
      ),
    }));
    console.warn(`[GotoUtils] Call-reports: no recording/transcript fields found. Sample leg keys:`, allLegs[0] ? Object.keys(allLegs[0]) : []);
    return { recordings: [], diagnostic };
  }

  // Sort by most recent, cap at maxCalls
  const candidates = withRecording
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => new Date(b.startTime ?? b.answerTime ?? 0).getTime() - new Date(a.startTime ?? a.answerTime ?? 0).getTime())
    .slice(0, maxCalls);

  // ── Step 4: Fetch transcripts for each candidate ───────────────────────────
  const recordings: GoToRecording[] = [];

  for (const leg of candidates) {
    // Extract the recording/transcription ID — try multiple field names
    const recordingId: string | undefined =
      leg.recordingId ??
      leg.recording?.id ??
      leg.recordings?.[0]?.id ??
      leg.recordingIds?.[0] ??
      undefined;

    const transcriptionId: string | undefined =
      leg.recording?.transcriptionId ??
      leg.transcriptId ??
      (leg.transcriptEnabled ? recordingId : undefined) ??
      undefined;

    const idToFetch = transcriptionId ?? recordingId;
    if (!idToFetch) continue;

    // Extract call metadata
    const startTimeVal: string = leg.startTime ?? leg.answerTime ?? new Date().toISOString();
    // Call-reports returns duration in MILLISECONDS (not seconds).  Heuristic: if the value is
    // suspiciously large (>4h in seconds), assume ms and convert.  talkDuration in seconds is fine.
    const rawDuration = Number(leg.duration ?? leg.talkDuration ?? 0);
    const durationVal: number = rawDuration > 14400 ? Math.round(rawDuration / 1000) : rawDuration;
    const direction: "INBOUND" | "OUTBOUND" =
      String(leg.direction ?? "").toUpperCase() === "INBOUND" ? "INBOUND" : "OUTBOUND";
    const callerNum: string = leg.from ?? leg.caller?.number ?? leg.callerNumber ?? "";
    const callerName: string = leg.caller?.name ?? leg.callerName ?? "";
    const calleeNum: string = leg.to ?? leg.callee?.number ?? leg.calleeNumber ?? "";

    try {
      const url = `https://api.goto.com/recording/v1/transcriptions/${encodeURIComponent(idToFetch)}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });

      console.log(`[GotoUtils] Transcription fetch id=${idToFetch}: HTTP ${resp.status}`);

      if (resp.ok) {
        const data = await resp.json();
        const results: Array<{ transcript: string; channel: number; startTimeMs: number }> = data.results ?? [];

        const transcript = results.length > 0
          ? results
              .sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0))
              .map((r) => `[${r.channel === 0 ? "Agent" : "Customer"}]: ${r.transcript ?? ""}`.trim())
              .filter((line) => line.length > 10)
              .join("\n")
          : undefined;

        recordings.push({
          id: recordingId ?? idToFetch,
          callLegId: leg.id ?? leg.legId ?? idToFetch,
          startTime: startTimeVal,
          duration: durationVal,
          direction,
          caller: { name: callerName || undefined, number: callerNum },
          callee: { name: undefined, number: calleeNum },
          hasTranscript: Boolean(transcript),
          transcript,
          transcriptionId: idToFetch,
        });
      } else {
        // Still add the recording entry so the coach knows a call existed but transcript unavailable
        recordings.push({
          id: recordingId ?? idToFetch,
          callLegId: leg.id ?? leg.legId ?? idToFetch,
          startTime: startTimeVal,
          duration: durationVal,
          direction,
          caller: { name: callerName || undefined, number: callerNum },
          callee: { name: undefined, number: calleeNum },
          hasTranscript: false,
          transcriptionId: idToFetch,
        });
      }
    } catch (err) {
      console.warn(`[GotoUtils] Transcript fetch error for id=${idToFetch}:`, err);
    }
  }

  const withTranscript = recordings.filter((r) => r.hasTranscript && r.transcript);
  console.log(`[GotoUtils] Call-reports transcription: ${withTranscript.length} / ${candidates.length} calls have transcripts`);
  diagnostic.transcriptsFound = withTranscript.length;

  return { recordings, diagnostic };
}

/**
 * Enrich recordings with transcript text.
 * Fetches the full transcript for each recording that has one.
 * 
 * @param token - GoTo access token
 * @param recordings - Array of recordings to enrich
 * @returns Same array with transcript field populated
 */
export async function enrichRecordingTranscripts(
  token: string,
  recordings: GoToRecording[],
): Promise<GoToRecording[]> {
  const enriched = [...recordings];

  for (const recording of enriched) {
    if (!recording.hasTranscript) continue;

    const transcriptId = recording.transcriptionId;
    if (!transcriptId) {
      console.warn(`[GotoUtils] Recording ${recording.id} has hasTranscript=true but no transcriptionId — skipping`);
      continue;
    }

    try {
      // GoTo API: GET /recording/v1/transcriptions/{transcriptId} → 302 redirect → JSON content
      // Node fetch follows redirects by default.
      const url = `https://api.goto.com/recording/v1/transcriptions/${encodeURIComponent(transcriptId)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        // GoTo transcript v1 format: { version: "1", results: [{ transcript, channel, startTimeMs, endTimeMs }] }
        // channel 0 = what the agent said, channel 1 = what the agent heard (customer's voice)
        const results: Array<{ transcript: string; channel: number; startTimeMs: number }> = data.results ?? [];
        if (results.length > 0) {
          recording.transcript = results
            .sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0))
            .map((r) => `[${r.channel === 0 ? "Agent" : "Customer"}]: ${r.transcript ?? ""}`.trim())
            .filter((line) => line.length > 10)
            .join("\n");
        }
      } else {
        console.warn(`[GotoUtils] Transcript fetch failed for transcriptId=${transcriptId}: ${response.status}`);
      }
    } catch (err) {
      console.warn(`[GotoUtils] Failed to fetch transcript for transcriptId=${transcriptId}:`, err);
    }
  }

  return enriched;
}

