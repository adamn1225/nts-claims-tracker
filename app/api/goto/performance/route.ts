/**
 * GET /api/goto/performance
 *
 * Admin-only endpoint. Uses the org admin GoTo token to pull performance data
 * for all brokers handling queue calls.
 *
 * DATA SOURCES (tried in order):
 *   1. Queue-caller analytics API (queue-caller.v1.read scope) — preferred.
 *      Returns per-call records with queue name, agent name, GoTo AI sentiment,
 *      and GoTo-extracted topics. Requires re-auth after adding scope.
 *   2. org-wide call-history fallback — filters to external calls only
 *      (excludes internal extension-to-extension calls like Noah ↔ Sheena).
 *
 * Query params:
 *   days    — lookback window in days (default: 14, max: 90)
 *   queues  — comma-separated queue names to filter (optional; default = all)
 *             e.g. ?queues=Heavy+Haulers+Call+Que,New+Estimate
 *
 * Response shape matches PerformanceData in components/performance/types.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminGoToToken,
  getAdminNumericAccountKey,
  fetchGoToCallHistoryForUser,
  fetchGoToCallQueues,
  fetchGoToQueueCallerCalls,
  fetchGoToOrgUsers,
  extractAgentDisplayName,
  type GoToCallRecord,
  type GoToQueueCallerRecord,
} from "@/lib/goto-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the call had a meaningful talk segment */
function isAnsweredQueueCall(r: GoToQueueCallerRecord): boolean {
  const outcome = r.outcome.toUpperCase();
  return outcome === "HANDLED" || outcome === "handled" || r.talkDurationSeconds > 0;
}

/** Maps GoTo AI sentiment string to our typed union */
function mapSentiment(raw: string): "positive" | "neutral" | "negative" {
  if (raw === "POSITIVE") return "positive";
  if (raw === "NEGATIVE") return "negative";
  return "neutral";
}

/** Returns true if the call-history record is an external (customer) call */
function isExternalCall(call: GoToCallRecord): boolean {
  // External phone numbers are > 5 digits; extensions are 3-5 digits
  const isExternal = (num: string) => num.replace(/\D/g, "").length > 5;
  return isExternal(call.caller.number) || isExternal(call.callee.number);
}

function isAnsweredHistoryCall(call: GoToCallRecord): boolean {
  return call.duration > 0;
}

function deriveHistorySentiment(call: GoToCallRecord): "positive" | "neutral" | "negative" {
  if (!isAnsweredHistoryCall(call)) return "neutral";
  if (call.duration > 180) return "positive";
  if (call.duration < 30) return "negative";
  return "neutral";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerBroker } = await supabase
    .from("brokers")
    .select("is_admin, is_sales_coach")
    .eq("id", user.id)
    .maybeSingle();

  const hasAccess = Boolean(callerBroker?.is_admin || (callerBroker as { is_sales_coach?: boolean })?.is_sales_coach);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "14", 10)));
  const pageMarker = searchParams.get("pageMarker") ?? undefined;
  const dateRange = { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() };
  const queueFilter = searchParams.get("queues")
    ? searchParams.get("queues")!.split(",").map((q) => q.trim()).filter(Boolean)
    : [];

  // ── Admin token ────────────────────────────────────────────────────────────
  const adminToken = await getAdminGoToToken();
  if (!adminToken) {
    return NextResponse.json({
      agentSummaries: [], callDetails: [], callScores: {}, groups: [],
      availableQueues: [],
      hasGoTo: false, dataSource: "api",
      fetchedAt: new Date().toISOString(),
      message: "No admin GoTo connection. Visit /api/goto/auth?admin=true to connect.",
    });
  }

  // ── Numeric account key ────────────────────────────────────────────────────
  const numericAccountKey = await getAdminNumericAccountKey(adminToken);
  if (!numericAccountKey) {
    return NextResponse.json(
      {
        error: "Could not determine GoTo numeric account key.",
        detail:
          "The admin GoTo token is missing the 'identity:' scope. Ensure 'Admin Center' is enabled " +
          "on your GoTo OAuth app at developer.goto.com, then re-authorize the admin connection at " +
          "/api/goto/auth?admin=true.",
        reconnectUrl: "/api/goto/auth?admin=true",
      },
      { status: 503 },
    );
  }

  // ── Load config, queues, and call data in parallel ─────────────────────────
  const [brokersResult, overridesResult, availableQueues, queueCallerResult, orgUsers] = await Promise.all([
    supabase.from("brokers").select("id, email, full_name, office_location").eq("is_active", true),
    supabase
      .from("performance_overrides")
      .select("goto_user_email, goto_user_key, display_name_override, office_location, is_excluded"),
    fetchGoToCallQueues(adminToken, numericAccountKey),
    fetchGoToQueueCallerCalls(adminToken, numericAccountKey, days, queueFilter.length > 0 ? queueFilter : undefined, pageMarker, 2000),
    fetchGoToOrgUsers(adminToken, numericAccountKey),
  ]);

  type BrokerRow = { id: string; email: string | null; full_name: string | null; office_location: string | null };
  type OverrideRow = { goto_user_email: string; goto_user_key: string | null; display_name_override: string | null; office_location: string | null; is_excluded: boolean };

  const brokerByEmail = new Map<string, BrokerRow>(
    ((brokersResult.data ?? []) as BrokerRow[]).map((b) => [b.email?.toLowerCase() ?? "", b]),
  );
  const overrideByEmail = new Map<string, OverrideRow>(
    ((overridesResult.data ?? []) as OverrideRow[]).map((o) => [o.goto_user_email?.toLowerCase(), o]),
  );

  const queueNames = availableQueues.map((q) => q.name);

  // ── TYPE DEFINITIONS ───────────────────────────────────────────────────────
  type AgentSummaryRow = {
    agentName: string;
    gotoUserKey: string;
    gotoUserEmail: string;
    officeLocation: string | null;
    handledCalls: number;
    totalTalkTimeSeconds: number;
    missedRingPct: number;
    utilizationPct: number;
    availableTimeSeconds: number;
    pausedTimeSeconds: number;
    sentimentPositivePct: number;
  };

  type CallDetailRow = {
    id: string;
    agentName: string;
    queue: string;
    talkDurationSeconds: number;
    outcome: string;
    aiSentiment: "positive" | "neutral" | "negative";
    startTime: string;
    callerName: string;
    callerNumber: string;
    topics?: string[];
    waitTimeSeconds?: number;
  };

  const agentSummaries: AgentSummaryRow[] = [];
  const callDetails: CallDetailRow[] = [];

  // ══════════════════════════════════════════════════════════════════════════
  // PATH A: Queue-caller analytics API (preferred — direct agent attribution)
  // ══════════════════════════════════════════════════════════════════════════
  if (queueCallerResult.calls !== null) {
    const queueCallerCalls = queueCallerResult.calls;
    console.log(`[Performance] Using queue-caller API — ${queueCallerCalls.length} records`);

    // Diagnostic: log field names from first record to understand API response shape
    if (queueCallerCalls.length > 0) {
      const handledSample = queueCallerCalls.find(r => isAnsweredQueueCall(r));
      const missedSample = queueCallerCalls.find(r => !isAnsweredQueueCall(r));
      console.log(`[Performance] First HANDLED record:`, JSON.stringify(handledSample ?? null));
      console.log(`[Performance] First MISSED record:`, JSON.stringify(missedSample ?? null));
      const withAgent = queueCallerCalls.filter(r => r.agentName).length;
      console.log(`[Performance] Records with agentName: ${withAgent} / ${queueCallerCalls.length}`);
    }

    // Group records by clean agent display name (strips device suffix like "(on abc123)").
    // Using the display name as the key merges records from the same agent across
    // multiple devices, preventing duplicate agentSummary rows for one person.
    const callsByAgent = new Map<string, GoToQueueCallerRecord[]>();
    for (const record of queueCallerCalls) {
      if (!record.agentName) continue; // Unanswered / no agent assigned
      const displayKey = extractAgentDisplayName(record.agentName);
      const bucket = callsByAgent.get(displayKey) ?? [];
      bucket.push(record);
      callsByAgent.set(displayKey, bucket);
    }

    // Build name → orgUser lookup so we can attach gotoUserKey/email to PATH A summaries.
    // Index by multiple name variants to maximize match rate.
    const orgUserByName = new Map<string, typeof orgUsers[number]>();
    for (const u of orgUsers) {
      const first = (u.firstName ?? "").trim();
      const last = (u.lastName ?? "").trim();
      const fullFL = `${first} ${last}`.trim().toLowerCase();
      const fullLF = `${last} ${first}`.trim().toLowerCase();
      // Normalize: remove accents, collapse spaces
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      if (fullFL) orgUserByName.set(fullFL, u);
      if (fullFL) orgUserByName.set(norm(fullFL), u);
      if (fullLF) orgUserByName.set(fullLF, u);
      if (last && first) orgUserByName.set(`${norm(last)} ${norm(first)}`, u);
      // First-name-only fallback (only if unique)
      if (first && !orgUserByName.has(first.toLowerCase())) orgUserByName.set(first.toLowerCase(), u);
    }

    for (const [rawAgentName, records] of callsByAgent) {
      const displayName = extractAgentDisplayName(rawAgentName);
      // Try to match to a broker by name to get office_location
      const emailKey = records.find((r) => r.callerNumber)?.callerNumber; // not email, try by name
      // Best effort: find a broker whose full_name matches the display name
      let officeLocation: string | null = null;
      for (const [email, broker] of brokerByEmail) {
        const brokName = broker.full_name?.toLowerCase().trim() ?? "";
        if (brokName && displayName.toLowerCase().includes(brokName.split(" ")[0])) {
          const ov = overrideByEmail.get(email);
          if (ov?.is_excluded) { officeLocation = null; break; }
          officeLocation = ov?.office_location?.trim() || broker.office_location?.trim() || null;
          break;
        }
      }

      const handled = records.filter(isAnsweredQueueCall);
      const missed = records.length - handled.length;
      const missedRingPct = records.length > 0
        ? Math.round((missed / records.length) * 1000) / 10
        : 0;
      const totalTalkTime = handled.reduce((s, r) => s + r.talkDurationSeconds, 0);
      const positiveCount = handled.filter((r) => r.aiSentiment === "POSITIVE").length;
      const sentimentPositivePct = handled.length > 0
        ? Math.round((positiveCount / handled.length) * 1000) / 10
        : 0;

      // Look up this agent's GoTo userKey from the org roster by name
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      const dnLower = displayName.toLowerCase();
      const matchedOrgUser = orgUserByName.get(dnLower)
        ?? orgUserByName.get(norm(dnLower))
        ?? orgUserByName.get(displayName.split(" ")[0].toLowerCase());
      if (matchedOrgUser) {
        console.log(`[Performance] Matched agent "${displayName}" → userKey ${matchedOrgUser.key}`);
      } else {
        console.warn(`[Performance] No org user match for agent "${displayName}"`);
      }

      agentSummaries.push({
        agentName: displayName,
        gotoUserKey: matchedOrgUser?.key ?? "",
        gotoUserEmail: matchedOrgUser?.email ?? "",
        officeLocation,
        handledCalls: handled.length,
        totalTalkTimeSeconds: totalTalkTime,
        missedRingPct,
        utilizationPct: 0,
        availableTimeSeconds: 0,
        pausedTimeSeconds: 0,
        sentimentPositivePct,
      });

      for (const r of records) {
        callDetails.push({
          id: r.legId,
          agentName: displayName,
          queue: r.queueName,
          talkDurationSeconds: r.talkDurationSeconds,
          outcome: r.outcome,
          aiSentiment: mapSentiment(r.aiSentiment),
          startTime: r.startTime,
          callerName: r.callerName,
          callerNumber: r.callerNumber,
          topics: r.topics.length > 0 ? r.topics : undefined,
          waitTimeSeconds: r.waitTimeSeconds,
        });
      }
    }

    agentSummaries.sort((a, b) => b.handledCalls - a.handledCalls);

    // Include unanswered / no-agent calls in callDetails so the dashboard
    // shows the full queue picture even if agent attribution is missing from the API.
    const agentAttributedIds = new Set(callDetails.map((c) => c.id));
    for (const r of queueCallerCalls) {
      if (agentAttributedIds.has(r.legId)) continue; // already added above
      callDetails.push({
        id: r.legId,
        agentName: r.agentName ? extractAgentDisplayName(r.agentName) : "",
        queue: r.queueName || r.dialedNumber || "Queue",
        talkDurationSeconds: r.talkDurationSeconds,
        outcome: r.outcome,
        aiSentiment: mapSentiment(r.aiSentiment),
        startTime: r.startTime,
        callerName: r.callerName,
        callerNumber: r.callerNumber,
        waitTimeSeconds: r.waitTimeSeconds,
      });
    }

    callDetails.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Fill in the full org roster — add zero-call rows for users not seen in queue-caller data.
    // This ensures the Directory tab shows all GoTo users, not just those who handled a queue call.
    const overridesMap = new Map<string, string>();
    for (const ov of (overridesResult.data ?? [])) {
      if (ov.goto_user_key && ov.display_name_override) overridesMap.set(ov.goto_user_key, ov.display_name_override);
    }
    const existingNames = new Set(agentSummaries.map((a) => a.agentName.toLowerCase()));
    const existingKeys = new Set(agentSummaries.map((a) => a.gotoUserKey).filter(Boolean));
    for (const user of orgUsers) {
      if (!user.key) continue; // Skip users without a GoTo key — would cause duplicate empty-key rows
      if (existingKeys.has(user.key)) continue; // Already in list from queue-caller data
      const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const displayName = overridesMap.get(user.key) ?? fullName;
      if (existingNames.has(displayName.toLowerCase())) continue;
      agentSummaries.push({
        agentName: displayName,
        gotoUserKey: user.key,
        gotoUserEmail: user.email,
        officeLocation: null,
        handledCalls: 0,
        totalTalkTimeSeconds: 0,
        missedRingPct: 0,
        utilizationPct: 0,
        availableTimeSeconds: 0,
        pausedTimeSeconds: 0,
        sentimentPositivePct: 0,
      });
    }
    agentSummaries.sort((a, b) => b.handledCalls - a.handledCalls);
    console.log(`[Performance] PATH A: ${agentSummaries.filter(a => a.handledCalls > 0).length} agents with calls, ${orgUsers.length} total org users`);

    const groups = buildGroups(agentSummaries);

    return NextResponse.json({
      agentSummaries,
      callDetails,
      callScores: {},
      groups,
      availableQueues: queueNames,
      hasGoTo: true,
      dataSource: "api",
      dataSourceDetail: "queue-caller-analytics",
      fetchedAt: new Date().toISOString(),
      totalQueueCalls: queueCallerCalls.length,
      attributedCalls: callDetails.length,
      nextPageMarker: queueCallerResult.nextPageMarker ?? null,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATH B: Org-wide call history via admin token (queue-caller API unavailable)
  //
  // Uses the admin token to fetch call records for all org users.
  // This does NOT require any agent to have a Salestrack CRM account.
  // ══════════════════════════════════════════════════════════════════════════
  const scopeMissing = queueCallerResult.scopeMissing;
  const tokenExpired = "tokenExpired" in queueCallerResult ? queueCallerResult.tokenExpired : false;
  console.log(`[Performance] queue-caller API unavailable (scopeMissing=${scopeMissing}, tokenExpired=${tokenExpired}) — using org-wide admin fallback`);
  {
    console.log("[Performance] Using org-wide call history (admin proxy)");

    // FALLBACK: Use org-wide call history with admin token
    // NOTE: GoTo restricts call-history to authenticated user only (even with admin permissions)
    // Without Contact Center Analytics, we can ONLY see the admin user's calls
    const { fetchGoToOrgCalls, fetchGoToOrgLines, fetchGoToOrgUsers } = await import("@/lib/goto-utils");

    // Fetch users first for name resolution
    const orgUsers = await fetchGoToOrgUsers(adminToken, numericAccountKey);
    console.log(`[Performance] Fetched ${orgUsers.length} GoTo users`);

    // Fetch calls (returns authenticated user's calls only - GoTo API limitation)
    const [orgCalls, orgLines] = await Promise.all([
      fetchGoToOrgCalls(adminToken, numericAccountKey, days),
      fetchGoToOrgLines(adminToken, numericAccountKey),
    ]);

    const adminUser = orgUsers.find(u => u.key === "4325746367515308727"); // Noah's userKey from /me endpoint
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "Admin User";

    console.log(`[Performance] Fetched ${orgCalls.length} calls, ${orgLines.length} phone lines, ${orgUsers.length} users from GoTo IAM API`);

    // Build DID → name mapping from orgLines
    const didToName = new Map<string, string>();
    const didToUserKey = new Map<string, string>();
    for (const line of orgLines) {
      const norm = line.number.replace(/\D/g, "");
      if (line.name) didToName.set(norm, line.name);
      if (line.userKey) didToUserKey.set(norm, line.userKey);
    }

    // CRITICAL: Extract agent names from call records themselves!
    // For each call, the agent's name appears in caller/callee depending on direction
    const didToAgentName = new Map<string, string>();
    const didToAgentNames = new Map<string, Set<string>>(); // Track ALL names per DID

    for (const call of orgCalls) {
      if (!call.ownerPhoneNumber) continue;
      const did = call.ownerPhoneNumber.replace(/\D/g, "");

      // Agent name is in caller/callee - match by checking which one is internal (extension)
      const callerIsInternal = call.caller.number && /^\d{3,4}$/.test(call.caller.number);
      const calleeIsInternal = call.callee.number && /^\d{3,4}$/.test(call.callee.number);

      let agentName: string | null = null;

      if (callerIsInternal && call.caller.name) {
        agentName = call.caller.name;
      } else if (calleeIsInternal && call.callee.name) {
        agentName = call.callee.name;
      }

      if (agentName) {
        // Track all unique names for this DID (hot-desking detection)
        if (!didToAgentNames.has(did)) {
          didToAgentNames.set(did, new Set());
        }
        didToAgentNames.get(did)!.add(agentName);

        // Store first name found (or most recent)
        didToAgentName.set(did, agentName);
      }
    }

    console.log(`[Performance] Extracted ${didToAgentName.size} agent names from call records`);

    // Log hot-desking detection
    for (const [did, names] of didToAgentNames) {
      if (names.size > 1) {
        console.log(`[Performance] ⚠️  Hot-desking detected on DID ${did}: ${Array.from(names).join(", ")}`);
      } else {
        console.log(`[Performance] DID ${did} → ${Array.from(names)[0]}`);
      }
    }

    // Build extension → user mapping from GoTo IAM users
    const extensionToUser = new Map<string, typeof orgUsers[0]>();
    for (const user of orgUsers) {
      const ext = user.extension;
      if (ext) {
        extensionToUser.set(ext, user);
      }
    }
    console.log(`[Performance] Mapped ${extensionToUser.size} extensions to GoTo users`);

    // Build userKey → name mapping from orgUsers (if available)
    const userKeyToName = new Map<string, string>();
    const emailToName = new Map<string, { name: string; userKey: string }>();
    for (const user of orgUsers) {
      const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      userKeyToName.set(user.key, fullName);
      // Also map email for potential lookup
      if (user.email) {
        emailToName.set(user.email.toLowerCase(), { name: fullName, userKey: user.key });
      }
    }

    // NOTE: We're NOT matching to SalesTrack brokers - this is a company-wide GoTo dashboard
    // It shows ALL employees with GoTo accounts (brokers, accountants, managers, etc.)
    console.log(`[Performance] Company-wide GoTo monitoring: ${orgUsers.length} total users`);

    // Also check performance_overrides for custom names by userKey
    const overridesMap = new Map<string, string>();
    for (const override of (overridesResult.data ?? [])) {
      if (override.goto_user_key && override.display_name_override) {
        overridesMap.set(override.goto_user_key, override.display_name_override);
      }
    }

    // Group calls by USER (not by DID) - users can have multiple phone numbers
    // Step 1: Match each call to a user by extension number
    const callsByUser = new Map<string, typeof orgCalls>();
    const unmatchedCalls: typeof orgCalls = [];

    for (const call of orgCalls) {
      // Find which extension is internal (agent)
      const callerExt = call.caller.number && /^\d{3,4}$/.test(call.caller.number) ? call.caller.number : null;
      const calleeExt = call.callee.number && /^\d{3,4}$/.test(call.callee.number) ? call.callee.number : null;

      let matchedUserKey: string | undefined;

      if (callerExt) {
        const user = extensionToUser.get(callerExt);
        if (user) matchedUserKey = user.key;
      }

      if (!matchedUserKey && calleeExt) {
        const user = extensionToUser.get(calleeExt);
        if (user) matchedUserKey = user.key;
      }

      if (matchedUserKey) {
        const bucket = callsByUser.get(matchedUserKey) ?? [];
        bucket.push(call);
        callsByUser.set(matchedUserKey, bucket);
      } else {
        unmatchedCalls.push(call);
      }
    }

    console.log(`[Performance] Matched ${callsByUser.size} users with calls, ${unmatchedCalls.length} unmatched calls`);
    console.log(`[Performance] Name resolution maps: didToUserKey=${didToUserKey.size}, userKeyToName=${userKeyToName.size}, didToAgentName=${didToAgentName.size}, overrides=${overridesMap.size}`);

    // Create agent summaries for each USER (one per user, not per DID)
    for (const [userKey, calls] of callsByUser) {
      const user = orgUsers.find(u => u.key === userKey);
      if (!user) continue;

      let displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;

      // Apply manual override if exists
      if (overridesMap.has(userKey)) {
        displayName = overridesMap.get(userKey)!;
      }

      console.log(`[Performance] User ${displayName} (${userKey}): ${calls.length} total calls`);

      const externalCalls = calls.filter((c) => {
        const callerLen = c.caller.number.replace(/\D/g, "").length;
        const calleeLen = c.callee.number.replace(/\D/g, "").length;
        return callerLen > 5 || calleeLen > 5; // External if > 5 digits
      });

      if (externalCalls.length === 0) continue;

      const handled = externalCalls.filter((c) => c.duration > 0);
      const totalTalkTime = handled.reduce((s, c) => s + c.duration, 0);
      const missedCount = externalCalls.length - handled.length;
      const missedRingPct = externalCalls.length > 0
        ? Math.round((missedCount / externalCalls.length) * 1000) / 10
        : 0;

      agentSummaries.push({
        agentName: displayName,
        gotoUserKey: userKey,
        gotoUserEmail: user.email,
        officeLocation: null,
        handledCalls: handled.length,
        totalTalkTimeSeconds: totalTalkTime,
        missedRingPct,
        utilizationPct: 0,
        availableTimeSeconds: 0,
        pausedTimeSeconds: 0,
        sentimentPositivePct: 0,
      });

      for (const call of externalCalls) {
        callDetails.push({
          id: call.legId,
          agentName: displayName,
          queue: call.direction === "INBOUND" ? "Inbound" : "Outbound",
          talkDurationSeconds: call.duration,
          outcome: call.duration > 0 ? "answered" : "no_answer",
          aiSentiment: call.duration > 180 ? "positive" : call.duration > 0 && call.duration < 30 ? "negative" : "neutral",
          startTime: call.startTime,
          callerName: call.caller.name ?? "",
          callerNumber: call.caller.number ?? "",
        });
      }
    }

    // Add ALL GoTo users who don't have calls yet (show complete org roster)
    const existingUserKeys = new Set(agentSummaries.map(a => a.gotoUserKey));

    for (const user of orgUsers) {
      if (existingUserKeys.has(user.key)) continue; // Skip users already added

      const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const override = overridesMap.get(user.key);

      agentSummaries.push({
        agentName: override || displayName,
        gotoUserKey: user.key,
        gotoUserEmail: user.email,
        officeLocation: null,
        handledCalls: 0,
        totalTalkTimeSeconds: 0,
        missedRingPct: 0,
        utilizationPct: 0,
        availableTimeSeconds: 0,
        pausedTimeSeconds: 0,
        sentimentPositivePct: 0,
      });
    }

    console.log(`[Performance] Added ${orgUsers.length - existingUserKeys.size} users with no call data (complete roster)`);

    agentSummaries.sort((a, b) => b.handledCalls - a.handledCalls);
    callDetails.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const groups = buildGroups(agentSummaries);

    console.log(`[Performance] Final results (fallback): ${agentSummaries.length} agents (${existingUserKeys.size} with calls, ${orgUsers.length - existingUserKeys.size} without), ${callDetails.length} calls`);

    return NextResponse.json({
      agentSummaries,
      callDetails,
      callScores: {},
      groups,
      availableQueues: [], // No queue data in fallback path
      hasGoTo: true,
      dataSource: "fallback-org-wide",
      fetchedAt: new Date().toISOString(),
      dateRange,
      needsReauth: false,
    });
  }
}

// ─── Shared group builder ──────────────────────────────────────────────────────

type AgentSummaryRow = {
  agentName: string;
  officeLocation: string | null;
  handledCalls: number;
  totalTalkTimeSeconds: number;
  missedRingPct: number;
  sentimentPositivePct: number;
};

function buildGroups(agentSummaries: AgentSummaryRow[]) {
  const groupMap = new Map<string, AgentSummaryRow[]>();
  for (const agent of agentSummaries) {
    const key = agent.officeLocation?.trim() || "Unassigned";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(agent);
  }

  return Array.from(groupMap.entries())
    .map(([groupName, agents]) => {
      const handledCalls = agents.reduce((s, a) => s + a.handledCalls, 0);
      const missed = agents.reduce((s, a) => {
        const total = a.handledCalls + Math.round((a.missedRingPct / 100) * (a.handledCalls / Math.max(1 - a.missedRingPct / 100, 0.01)));
        return s + (total - a.handledCalls);
      }, 0);
      const totalTalk = agents.reduce((s, a) => s + a.totalTalkTimeSeconds, 0);
      const avgTalkTimeSeconds = handledCalls > 0 ? Math.round(totalTalk / handledCalls) : 0;
      const avgMissedPct = agents.length > 0
        ? Math.round((agents.reduce((s, a) => s + a.missedRingPct, 0) / agents.length) * 10) / 10
        : 0;
      const avgSentimentPct = agents.length > 0
        ? Math.round((agents.reduce((s, a) => s + a.sentimentPositivePct, 0) / agents.length) * 10) / 10
        : 0;
      const sorted = [...agents].sort((a, b) => b.handledCalls - a.handledCalls);
      return {
        groupName,
        agentCount: agents.length,
        totalCalls: handledCalls + missed,
        handledCalls,
        missedCalls: missed,
        avgTalkTimeSeconds,
        missedRingPct: avgMissedPct,
        sentimentPositivePct: avgSentimentPct,
        topAgent: sorted[0]?.agentName ?? null,
        bottomAgent: sorted[sorted.length - 1]?.agentName ?? null,
      };
    })
    .sort((a, b) => b.handledCalls - a.handledCalls);
}
