/**
 * GET /api/goto/user-call-history
 * 
 * Fetches detailed call history for a specific GoTo user
 * Uses admin token to query any user's call history
 * 
 * Query params:
 *   userKey - GoTo user key (required)
 *   days - Lookback window (default: 30, max: 90)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken, getAdminNumericAccountKey } from "@/lib/goto-utils";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

    if (!broker?.is_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("userKey");
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30")));

    if (!userKey) {
        return NextResponse.json({ error: "userKey is required" }, { status: 400 });
    }

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({ error: "No admin GoTo token" }, { status: 424 });
    }

    const accountKey = await getAdminNumericAccountKey(adminToken);
    if (!accountKey) {
        return NextResponse.json({ error: "Could not get account key" }, { status: 424 });
    }

    try {
        // Calculate date range
        const endTime = new Date();
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - days);

        console.log(`[User Call History] Fetching calls for userKey ${userKey} (${days} days)`);

        // Fetch call history for specific user
        const url = new URL(`https://api.goto.com/call-history/v1/users/${encodeURIComponent(userKey)}/calls`);
        url.searchParams.set("startTime", startTime.toISOString());
        url.searchParams.set("endTime", endTime.toISOString());
        url.searchParams.set("pageSize", "500");

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${adminToken}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[User Call History] HTTP ${response.status}:`, errorBody);
            return NextResponse.json({
                error: `HTTP ${response.status}`,
                errorBody,
            }, { status: response.status });
        }

        const data = await response.json();
        const calls = data.items || [];

        console.log(`[User Call History] Fetched ${calls.length} calls for user ${userKey}`);

        // Filter to external calls only (exclude internal extension-to-extension)
        const externalCalls = calls.filter((call: any) => {
            const callerLen = (call.caller?.number || "").replace(/\D/g, "").length;
            const calleeLen = (call.callee?.number || "").replace(/\D/g, "").length;
            return callerLen > 5 || calleeLen > 5;
        });

        // Calculate stats
        const totalCalls = externalCalls.length;
        const answeredCalls = externalCalls.filter((c: any) => c.duration > 0);
        const missedCalls = totalCalls - answeredCalls.length;
        const totalDuration = answeredCalls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0);
        const avgDuration = answeredCalls.length > 0 ? Math.round(totalDuration / answeredCalls.length) : 0;
        const inboundCalls = externalCalls.filter((c: any) => c.direction === "INBOUND").length;
        const outboundCalls = externalCalls.filter((c: any) => c.direction === "OUTBOUND").length;

        // Format calls for frontend
        const formattedCalls = externalCalls.map((call: any) => ({
            legId: call.legId,
            caller: {
                name: call.caller?.name || "",
                number: call.caller?.number || "",
            },
            callee: {
                name: call.callee?.name || "",
                number: call.callee?.number || "",
            },
            direction: call.direction,
            startTime: call.startTime,
            answerTime: call.answerTime || null,
            duration: call.duration || 0,
            hangupCause: call.hangupCause,
            outcome: call.duration > 0 ? "answered" : "no_answer",
        }));

        // Sort by most recent first
        formattedCalls.sort((a: any, b: any) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

        return NextResponse.json({
            success: true,
            userKey,
            dateRange: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                days,
            },
            stats: {
                totalCalls,
                answeredCalls: answeredCalls.length,
                missedCalls,
                totalDurationSeconds: totalDuration,
                avgDurationSeconds: avgDuration,
                inboundCalls,
                outboundCalls,
            },
            calls: formattedCalls,
            pagination: {
                nextPageMarker: data.nextPageMarker,
                pageSize: data.pageSize || 100,
            },
        });
    } catch (err) {
        console.error("[User Call History] Error:", err);
        return NextResponse.json({
            error: String(err),
        }, { status: 500 });
    }
}
