/**
 * GET /api/goto/test-contact-center
 * 
 * Test endpoint to verify Contact Center Analytics API access
 * Tests both queue-caller-details and queue-metrics endpoints
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

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({ error: "No admin GoTo token" }, { status: 424 });
    }

    const accountKey = await getAdminNumericAccountKey(adminToken);
    if (!accountKey) {
        return NextResponse.json({ error: "Could not get account key" }, { status: 424 });
    }

    const results: any = {
        accountKey,
        timestamp: new Date().toISOString(),
        tests: [],
    };

    // Calculate date range (last 7 days)
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 7);

    // TEST 1: Queue Caller Details
    try {
        console.log(`[Contact Center Test] Testing queue-caller-details endpoint...`);

        const callerDetailsUrl = `https://api.goto.com/contact-center-analytics/v1/accounts/${accountKey}/queue-caller-details`;

        const callerDetailsResponse = await fetch(callerDetailsUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                pageSize: 100,
            }),
        });

        const callerDetailsData = callerDetailsResponse.ok
            ? await callerDetailsResponse.json()
            : await callerDetailsResponse.text();

        // Find a HANDLED and an unhandled sample to compare field shapes
        const allItems: any[] = callerDetailsResponse.ok ? (callerDetailsData.items ?? []) : [];
        const handledSample = allItems.find((i: any) => i.outcome === "HANDLED" || (i.talkDuration ?? 0) > 0) ?? null;
        const missedSample = allItems.find((i: any) => i.outcome !== "HANDLED" && (i.talkDuration ?? 0) === 0) ?? null;
        const outcomeBreakdown: Record<string, number> = {};
        for (const item of allItems) {
          outcomeBreakdown[item.outcome ?? "unknown"] = (outcomeBreakdown[item.outcome ?? "unknown"] ?? 0) + 1;
        }
        const fieldNames = allItems.length > 0 ? Object.keys(allItems[0]) : [];

        results.tests.push({
            endpoint: "queue-caller-details",
            url: callerDetailsUrl,
            status: callerDetailsResponse.status,
            statusText: callerDetailsResponse.statusText,
            success: callerDetailsResponse.ok,
            itemCount: callerDetailsResponse.ok ? (callerDetailsData.items?.length || 0) : 0,
            hasNextPage: callerDetailsResponse.ok ? !!callerDetailsData.nextPageMarker : false,
            fieldNames,
            outcomeBreakdown,
            handledSample,
            missedSample,
            error: !callerDetailsResponse.ok ? callerDetailsData : null,
        });

        console.log(`[Contact Center Test] queue-caller-details: ${callerDetailsResponse.status} - ${callerDetailsResponse.ok ? `${callerDetailsData.items?.length || 0} items` : 'FAILED'}`);
    } catch (err) {
        results.tests.push({
            endpoint: "queue-caller-details",
            success: false,
            error: String(err),
        });
        console.error(`[Contact Center Test] queue-caller-details error:`, err);
    }

    // TEST 2: Queue Metrics
    try {
        console.log(`[Contact Center Test] Testing queue-metrics endpoint...`);

        const metricsUrl = `https://api.goto.com/contact-center-analytics/v1/accounts/${accountKey}/queue-metrics`;

        const metricsResponse = await fetch(metricsUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                pageSize: 96,
            }),
        });

        const metricsData = metricsResponse.ok
            ? await metricsResponse.json()
            : await metricsResponse.text();

        results.tests.push({
            endpoint: "queue-metrics",
            url: metricsUrl,
            status: metricsResponse.status,
            statusText: metricsResponse.statusText,
            success: metricsResponse.ok,
            itemCount: metricsResponse.ok ? (metricsData.items?.length || 0) : 0,
            hasNextPage: metricsResponse.ok ? !!metricsData.nextPageMarker : false,
            sampleData: metricsResponse.ok && metricsData.items?.length > 0
                ? metricsData.items[0]
                : null,
            error: !metricsResponse.ok ? metricsData : null,
        });

        console.log(`[Contact Center Test] queue-metrics: ${metricsResponse.status} - ${metricsResponse.ok ? `${metricsData.items?.length || 0} periods` : 'FAILED'}`);
    } catch (err) {
        results.tests.push({
            endpoint: "queue-metrics",
            success: false,
            error: String(err),
        });
        console.error(`[Contact Center Test] queue-metrics error:`, err);
    }

    // TEST 3: Agent Details (per-agent stats per time interval)
    try {
        console.log(`[Contact Center Test] Testing agent-details endpoint...`);
        const agentDetailsUrl = `https://api.goto.com/contact-center-analytics/v1/accounts/${accountKey}/agent-details`;
        const agentDetailsResponse = await fetch(agentDetailsUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                pageSize: 50,
            }),
        });
        const agentDetailsData = agentDetailsResponse.ok
            ? await agentDetailsResponse.json()
            : await agentDetailsResponse.text();
        const agentItems: any[] = agentDetailsResponse.ok ? (agentDetailsData.items ?? []) : [];
        results.tests.push({
            endpoint: "agent-details",
            url: agentDetailsUrl,
            status: agentDetailsResponse.status,
            statusText: agentDetailsResponse.statusText,
            success: agentDetailsResponse.ok,
            itemCount: agentItems.length,
            hasNextPage: agentDetailsResponse.ok ? !!agentDetailsData.nextPageMarker : false,
            fieldNames: agentItems.length > 0 ? Object.keys(agentItems[0]) : [],
            sampleData: agentItems[0] ?? null,
            error: !agentDetailsResponse.ok ? agentDetailsData : null,
        });
        console.log(`[Contact Center Test] agent-details: ${agentDetailsResponse.status} - ${agentDetailsResponse.ok ? `${agentItems.length} items` : 'FAILED'}`);
    } catch (err) {
        results.tests.push({ endpoint: "agent-details", success: false, error: String(err) });
        console.error(`[Contact Center Test] agent-details error:`, err);
    }

    // TEST 4: Agent Status Details (login/logout/pause per agent)
    try {
        console.log(`[Contact Center Test] Testing agent-status-details endpoint...`);
        const agentStatusUrl = `https://api.goto.com/contact-center-analytics/v1/accounts/${accountKey}/agent-status-details`;
        const agentStatusResponse = await fetch(agentStatusUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                pageSize: 50,
            }),
        });
        const agentStatusData = agentStatusResponse.ok
            ? await agentStatusResponse.json()
            : await agentStatusResponse.text();
        const statusItems: any[] = agentStatusResponse.ok ? (agentStatusData.items ?? []) : [];
        results.tests.push({
            endpoint: "agent-status-details",
            url: agentStatusUrl,
            status: agentStatusResponse.status,
            statusText: agentStatusResponse.statusText,
            success: agentStatusResponse.ok,
            itemCount: statusItems.length,
            hasNextPage: agentStatusResponse.ok ? !!agentStatusData.nextPageMarker : false,
            fieldNames: statusItems.length > 0 ? Object.keys(statusItems[0]) : [],
            sampleData: statusItems[0] ?? null,
            error: !agentStatusResponse.ok ? agentStatusData : null,
        });
        console.log(`[Contact Center Test] agent-status-details: ${agentStatusResponse.status} - ${agentStatusResponse.ok ? `${statusItems.length} items` : 'FAILED'}`);
    } catch (err) {
        results.tests.push({ endpoint: "agent-status-details", success: false, error: String(err) });
        console.error(`[Contact Center Test] agent-status-details error:`, err);
    }

    // Summary
    const successCount = results.tests.filter((t: any) => t.success).length;
    const failCount = results.tests.filter((t: any) => !t.success).length;

    results.summary = {
        totalTests: results.tests.length,
        passed: successCount,
        failed: failCount,
        allPassed: successCount === results.tests.length,
        contactCenterEnabled: successCount > 0,
    };

    console.log(`[Contact Center Test] Summary: ${successCount}/${results.tests.length} tests passed`);

    if (results.summary.contactCenterEnabled) {
        console.log(`[Contact Center Test] 🎉 Contact Center Analytics API is ENABLED!`);
    } else {
        console.log(`[Contact Center Test] ❌ Contact Center Analytics API is NOT available`);
    }

    return NextResponse.json(results);
}
