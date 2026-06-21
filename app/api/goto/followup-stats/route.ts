/**
 * GET /api/goto/followup-stats
 *
 * Admin-only. Cross-references missed inbound queue calls against outbound
 * call history for every active GoTo user to answer:
 *   "For each missed caller, did any agent call them back within 24 hours?"
 *
 * Data sources:
 *   1. contact-center-analytics/v1 queue-caller-details — finds missed calls
 *   2. call-reports/v1/reports/user-activity/{userId} — finds outbound follow-ups
 *      Uses admin token which CAN read all org users' call records via this endpoint.
 *      (call-history/v1 is user-scoped and doesn't work with admin tokens)
 *
 * Query params:
 *   days          — lookback window in days (default: 14, max: 30)
 *   windowHours   — how many hours after a miss counts as a follow-up (default: 24)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    getAdminGoToToken,
    getAdminNumericAccountKey,
    fetchGoToQueueCallerCalls,
    normalizePhoneDigits,
} from "@/lib/goto-utils";

interface UserActivitySummary {
    userId: string;      // UUID format e.g. "f402188a-df68-4a78-a90a-3b6eb4095760"
    userName: string;
    totalCallVolume?: number;
    outboundCallVolume?: number;
    inboundCallVolume?: number;
}

interface UserCallRecord {
    startTime: string;
    endTime?: string;
    answerTime?: string;
    direction: string;
    disposition?: number;
    duration?: number;
    caller: { name?: string | null; number?: string };
    callee: { name?: string | null; number?: string };
    legId?: string;
    recordingIds?: string[];
    queue?: string | null;
}

/**
 * Fetch all org users who had any calls in the given date range.
 * Returns userId UUIDs + names — much faster than the user roster endpoint,
 * and these UUIDs are what user-activity/detail requires.
 */
async function fetchOrgUsersWithActivity(
    adminToken: string,
    startTime: string,
    endTime: string,
): Promise<UserActivitySummary[]> {
    const users: UserActivitySummary[] = [];
    let pageMarker: string | undefined;

    do {
        const url = new URL("https://api.goto.com/call-reports/v1/reports/user-activity");
        url.searchParams.set("startTime", startTime);
        url.searchParams.set("endTime", endTime);
        url.searchParams.set("pageSize", "100");
        if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

        const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });

        if (!resp.ok) break;

        const body = await resp.json();
        users.push(...(body?.items ?? []));
        pageMarker = body?.nextPageMarker ?? undefined;
    } while (pageMarker);

    return users;
}

/**
 * Fetch all OUTBOUND call records for a specific org user in the date range.
 * Paginates fully. Returns empty array on any error.
 */
async function fetchUserOutboundCalls(
    adminToken: string,
    userId: string,
    startTime: string,
    endTime: string,
): Promise<UserCallRecord[]> {
    const calls: UserCallRecord[] = [];
    let pageMarker: string | undefined;

    do {
        const url = new URL(
            `https://api.goto.com/call-reports/v1/reports/user-activity/${encodeURIComponent(userId)}`,
        );
        url.searchParams.set("startTime", startTime);
        url.searchParams.set("endTime", endTime);
        url.searchParams.set("pageSize", "500");
        if (pageMarker) url.searchParams.set("pageMarker", pageMarker);

        const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });

        if (!resp.ok) break;

        const body = await resp.json();
        const items: UserCallRecord[] = body?.items ?? [];
        calls.push(...items.filter((c) => c.direction?.toUpperCase() === "OUTBOUND"));
        pageMarker = body?.nextPageMarker ?? undefined;

        if (pageMarker) {
            await new Promise((r) => setTimeout(r, 400));
        }
    } while (pageMarker);

    return calls;
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: teamMember } = await supabase
        .from("team_members")
        .select("is_admin, is_sales_coach")
        .eq("id", user.id)
        .maybeSingle();

    const hasAccess = Boolean(teamMember?.is_admin || (teamMember as { is_sales_coach?: boolean })?.is_sales_coach);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "14", 10)));
    const windowHours = Math.min(72, Math.max(1, parseInt(searchParams.get("windowHours") ?? "24", 10)));

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json(
            { error: "No admin GoTo connection. Visit /api/goto/auth?admin=true to connect." },
            { status: 424 },
        );
    }

    const numericAccountKey = await getAdminNumericAccountKey(adminToken);
    if (!numericAccountKey) {
        return NextResponse.json({ error: "Could not determine GoTo account key." }, { status: 424 });
    }

    const startIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const endIso = new Date().toISOString();

    // ── 1. Fetch all missed queue calls (paginate fully for accuracy) ─────────
    const allQueueCalls: Awaited<ReturnType<typeof fetchGoToQueueCallerCalls>> extends
        { calls: infer T } ? NonNullable<T> : never[] = [];

    let pageMarker: string | undefined;
    let scopeError = false;
    let tokenExpiredError = false;
    let rateLimitedError = false;

    do {
        const result = await fetchGoToQueueCallerCalls(
            adminToken,
            numericAccountKey,
            days,
            undefined,
            pageMarker,
        );

        if (result.calls === null) {
            if (result.tokenExpired) {
                tokenExpiredError = true;
            } else if (result.rateLimited) {
                rateLimitedError = true;
            } else if (result.scopeMissing) {
                scopeError = true;
            }
            break;
        }

        (allQueueCalls as typeof result.calls).push(...result.calls);
        pageMarker = result.nextPageMarker ?? undefined;

        if (pageMarker) {
            await new Promise((r) => setTimeout(r, 700));
        }

        if ((allQueueCalls as typeof result.calls).length >= 3000) {
            break;
        }
    } while (pageMarker);

    if (tokenExpiredError) {
        return NextResponse.json(
            { error: "GoTo admin token has expired or been revoked. Go to Settings → GoTo Connect and click Reconnect." },
            { status: 424 },
        );
    }

    if (rateLimitedError) {
        return NextResponse.json(
            { error: "GoTo rate limit hit while fetching queue data. Wait 30–60 seconds and try again." },
            { status: 429 },
        );
    }

    if (scopeError) {
        return NextResponse.json(
            { error: "GoTo admin token is missing the queue-caller analytics permission. Re-authenticate via Settings → GoTo Connect using the admin account that has the Contact Center Complete license." },
            { status: 424 },
        );
    }

    // ── 2. Extract unique missed caller numbers + their miss timestamps ────────
    const missedByNorm = new Map<string, number[]>(); // normalizedNumber → [timestamp_ms, ...]

    for (const call of allQueueCalls as import("@/lib/goto-utils").GoToQueueCallerRecord[]) {
        if (call.talkDurationSeconds > 0) continue; // answered — skip
        const raw = call.callerNumber ?? "";
        if (!raw || raw === "Anonymous" || raw === "unknown") continue;

        const norm = normalizePhoneDigits(raw);
        if (!norm || norm.length < 7) continue;

        const ts = new Date(call.startTime).getTime();
        const arr = missedByNorm.get(norm) ?? [];
        arr.push(ts);
        missedByNorm.set(norm, arr);
    }

    const totalMissedNumbers = missedByNorm.size;

    if (totalMissedNumbers === 0) {
        return NextResponse.json({
            days,
            windowHours,
            totalMissedNumbers: 0,
            followedUp: 0,
            notFollowedUp: 0,
            followupRate: 0,
            byAgent: [],
            agentsChecked: 0,
        });
    }

    // ── 3. Get all org users who had calls in this period ─────────────────────
    // Uses call-reports/v1/reports/user-activity — admin token can read all users.
    // Returns UUIDs needed for the detail endpoint (not the numeric keys from user roster).
    const orgUsers = await fetchOrgUsersWithActivity(adminToken, startIso, endIso);

    // ── 4. Fetch each user's outbound calls and cross-reference ───────────────
    // Batched 10 at a time in parallel — reduces 100 sequential calls to ~10 batches.
    const BATCH_SIZE = 10;
    const followedUpNumbers = new Set<string>();

    type AgentStats = {
        agentName: string;
        followups: number;
        responseTimesMinutes: number[];
    };
    const agentStats = new Map<string, AgentStats>();

    for (let i = 0; i < orgUsers.length; i += BATCH_SIZE) {
        const batch = orgUsers.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
            batch.map((u) => fetchUserOutboundCalls(adminToken, u.userId, startIso, endIso)),
        );

        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const orgUser = batch[j];

            if (result.status !== "fulfilled") continue;
            const outboundCalls = result.value;

            let userFollowupCount = 0;
            const responseTimes: number[] = [];

            for (const call of outboundCalls) {
                const calleeNorm = normalizePhoneDigits(call.callee?.number ?? "");
                if (!calleeNorm || calleeNorm.length < 7) continue;

                const missedTimestamps = missedByNorm.get(calleeNorm);
                if (!missedTimestamps) continue;

                const callTimeMs = new Date(call.startTime).getTime();
                const windowMs = windowHours * 3600 * 1000;

                // Was this outbound call made AFTER a miss and within the follow-up window?
                const relevantMiss = missedTimestamps.find(
                    (mt) => callTimeMs > mt && callTimeMs - mt <= windowMs,
                );

                if (relevantMiss !== undefined) {
                    followedUpNumbers.add(calleeNorm);
                    userFollowupCount++;
                    responseTimes.push(Math.round((callTimeMs - relevantMiss) / 60000));
                }
            }

            if (userFollowupCount > 0) {
                agentStats.set(orgUser.userId, {
                    agentName: orgUser.userName,
                    followups: userFollowupCount,
                    responseTimesMinutes: responseTimes,
                });
            }
        }

        // Short gap between batches to stay under GoTo burst rate limits
        if (i + BATCH_SIZE < orgUsers.length) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    // ── 5. Build response ─────────────────────────────────────────────────────
    const followedUpCount = followedUpNumbers.size;
    const notFollowedUp = totalMissedNumbers - followedUpCount;
    const followupRate =
        totalMissedNumbers > 0 ? Math.round((followedUpCount / totalMissedNumbers) * 100) : 0;

    const byAgent = [...agentStats.values()]
        .sort((a, b) => b.followups - a.followups)
        .map((a) => ({
            agentName: a.agentName,
            followups: a.followups,
            avgResponseMinutes:
                a.responseTimesMinutes.length > 0
                    ? Math.round(
                        a.responseTimesMinutes.reduce((s, v) => s + v, 0) /
                        a.responseTimesMinutes.length,
                    )
                    : null,
        }));

    return NextResponse.json({
        days,
        windowHours,
        totalMissedNumbers,
        followedUp: followedUpCount,
        notFollowedUp,
        followupRate,
        byAgent,
        agentsChecked: orgUsers.length,
    });
}
