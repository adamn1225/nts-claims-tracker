/**
 * GET /api/goto/agent-status
 *
 * Admin-only. Fetches historical agent status events from GoTo's
 * contact-center-analytics API, then derives:
 *   1. Current (last-known) status per agent
 *   2. Time-on-queue breakdown per agent (seconds per status type)
 *
 * Requires scope: cc-analytics.v1.agent-status.read
 * Note: This is a DIFFERENT scope from queue-caller.v1.read — if the admin
 * token was authorized before this scope was added, re-auth via Force Reconnect.
 *
 * Query params:
 *   days  — lookback window in days (default: 7, max: 14)
 *           Capped at 14 because the API paginates by hours (max 24h/page)
 *           so 14 days = 14 paginated requests.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken, getAdminNumericAccountKey } from "@/lib/goto-utils";

// Raw event from the agent-statuses API (fields inferred from docs + defensive)
interface AgentStatusEvent {
    agentId?: string;
    agentName?: string;
    queueId?: string;
    queueName?: string;
    /** Status string e.g. AVAILABLE, HANDLING, WRAP_UP, AWAY, LOGGED_OUT */
    status?: string;
    startTime?: string;
    /** Duration in seconds (field name varies — we try multiple) */
    durationSeconds?: number;
    duration?: number;
    durationMs?: number;
}

export interface AgentCurrentStatus {
    agentId: string;
    agentName: string;
    status: string;
    queueName: string;
    since: string;
    /** Seconds in the current status */
    durationSeconds: number;
}

export interface AgentTimeBreakdown {
    agentId: string;
    agentName: string;
    totalSeconds: number;
    byStatus: Record<string, number>; // status → seconds
}

function normalizeDuration(event: AgentStatusEvent): number {
    if (typeof event.durationSeconds === "number") return event.durationSeconds;
    if (typeof event.duration === "number") return event.duration;
    if (typeof event.durationMs === "number") return Math.round(event.durationMs / 1000);
    return 0;
}

/** Decode the JWT payload (second segment) without verifying the signature. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    } catch {
        return null;
    }
}

/** Extract scope strings from the GoTo JWT (`sc` claim, space-separated). */
function getTokenScopes(token: string): string[] {
    const payload = decodeJwtPayload(token);
    if (!payload) return [];
    if (typeof payload.sc === "string") return payload.sc.split(" ").filter(Boolean);
    if (Array.isArray(payload.sc)) return payload.sc as string[];
    return [];
}

/**
 * Fetch one page of agent status events.
 * Returns { items, nextPageMarker }.
 * Retries once on transient 502 before throwing.
 */
async function fetchAgentStatusPage(
    adminToken: string,
    accountKey: string,
    startTime: string,
    endTime: string,
    pageMarker?: string,
): Promise<{ items: AgentStatusEvent[]; nextPageMarker?: string }> {
    const url = `https://api.goto.com/contact-center-analytics/v1/accounts/${accountKey}/agent-statuses`;

    const body: Record<string, unknown> = {
        startTime,
        endTime,
        pageSize: 24, // 24 hours of data per page (API max per docs: [2..24])
    };
    if (pageMarker) body.pageMarker = pageMarker;

    const makeRequest = () =>
        fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(body),
        });

    let resp = await makeRequest();

    // Retry once on transient 502/503
    if (resp.status === 502 || resp.status === 503) {
        await new Promise((r) => setTimeout(r, 1500));
        resp = await makeRequest();
    }

    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`agent-statuses HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }

    const data = await resp.json();
    return {
        items: data?.items ?? [],
        nextPageMarker: data?.nextPageMarker,
    };
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin, is_sales_coach")
        .eq("id", user.id)
        .maybeSingle();
    const hasAccess = Boolean(broker?.is_admin || (broker as { is_sales_coach?: boolean })?.is_sales_coach);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(14, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json(
            { error: "No admin GoTo connection. Visit /api/goto/auth?admin=true to connect." },
            { status: 424 },
        );
    }

    const accountKey = await getAdminNumericAccountKey(adminToken);
    if (!accountKey) {
        return NextResponse.json({ error: "Could not determine GoTo account key." }, { status: 424 });
    }

    // Pre-check: verify the token has the required scope before hitting the API.
    // GoTo returns 502 (not 403) when this scope is missing — so catching it here
    // gives users a clear "Force Reconnect" message instead of a cryptic server error.
    const tokenScopes = getTokenScopes(adminToken);
    const hasAgentStatusScope =
        tokenScopes.length === 0 || // can't decode JWT (opaque token) — try anyway
        tokenScopes.some((s) => s.includes("cc-analytics.v1.agent-status"));
    if (!hasAgentStatusScope) {
        return NextResponse.json(
            {
                error: "Insufficient scope. The admin GoTo token needs cc-analytics.v1.agent-status.read scope. Click 'Force Reconnect' to re-authorize.",
                scopeError: true,
            },
            { status: 403 },
        );
    }

    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Paginate through all agent status events for the window
    const allEvents: AgentStatusEvent[] = [];
    let pageMarker: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = days + 2; // safety cap

    try {
        do {
            const page = await fetchAgentStatusPage(adminToken, accountKey, startTime, endTime, pageMarker);
            allEvents.push(...page.items);
            pageMarker = page.nextPageMarker;
            pageCount++;
        } while (pageMarker && pageCount < MAX_PAGES);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[agent-status] API error:", msg);
        // Scope error → surface clearly so user knows to re-auth
        if (msg.includes("403") || msg.includes("scope") || msg.includes("AUTHZ")) {
            return NextResponse.json(
                {
                    error: "Insufficient scope. The admin GoTo token needs cc-analytics.v1.agent-status.read scope. Click 'Force Reconnect' to re-authorize.",
                    scopeError: true,
                },
                { status: 403 },
            );
        }
        // 502 from GoTo usually means the token lacks this scope (GoTo API inconsistency)
        // or their backend is temporarily unavailable.
        if (msg.includes("502")) {
            return NextResponse.json(
                {
                    error: "GoTo returned a 502 error. This usually means the admin token needs re-authorization with the cc-analytics.v1.agent-status.read scope. Click 'Force Reconnect' and re-authorize, then try again.",
                    scopeError: true,
                },
                { status: 502 },
            );
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ── Derive current status per agent ─────────────────────────────────────
    // allEvents is sorted ascending by startTime — last event per agentId = current
    const latestByAgent = new Map<string, AgentStatusEvent>();
    for (const event of allEvents) {
        if (!event.agentId) continue;
        latestByAgent.set(event.agentId, event);
    }

    const currentStatuses: AgentCurrentStatus[] = [...latestByAgent.values()]
        .map((e) => ({
            agentId: e.agentId ?? "",
            agentName: e.agentName ?? e.agentId ?? "Unknown",
            status: e.status ?? "UNKNOWN",
            queueName: e.queueName ?? "",
            since: e.startTime ?? "",
            durationSeconds: normalizeDuration(e),
        }))
        .sort((a, b) => a.agentName.localeCompare(b.agentName));

    // ── Derive time-on-queue breakdown per agent ─────────────────────────────
    const breakdownMap = new Map<string, AgentTimeBreakdown>();
    for (const event of allEvents) {
        if (!event.agentId) continue;
        const secs = normalizeDuration(event);
        if (secs === 0) continue;
        const status = event.status ?? "UNKNOWN";

        let entry = breakdownMap.get(event.agentId);
        if (!entry) {
            entry = {
                agentId: event.agentId,
                agentName: event.agentName ?? event.agentId ?? "Unknown",
                totalSeconds: 0,
                byStatus: {},
            };
            breakdownMap.set(event.agentId, entry);
        }
        entry.totalSeconds += secs;
        entry.byStatus[status] = (entry.byStatus[status] ?? 0) + secs;
    }

    const timeBreakdown: AgentTimeBreakdown[] = [...breakdownMap.values()]
        .sort((a, b) => b.totalSeconds - a.totalSeconds);

    return NextResponse.json({
        days,
        pagesLoaded: pageCount,
        totalEvents: allEvents.length,
        currentStatuses,
        timeBreakdown,
    });
}
