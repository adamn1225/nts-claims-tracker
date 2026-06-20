/**
 * GET /api/goto/test-recordings
 *
 * Diagnostic: probes the call-reports user-activity detail endpoint looking for
 * recordingId / transcriptEnabled fields on individual call legs.
 *
 * Per GoTo docs: "The recordingId for a given leg can also be found in the call
 * events report. If the field transcriptEnabled is true, the same id can be used
 * to fetch a transcript."
 *
 * Steps:
 *  1. GET /call-reports/v1/reports/user-activity  → find agent userId UUIDs
 *  2. GET /call-reports/v1/reports/user-activity/{userId}  → individual call legs
 *  3. Show ALL fields on first few records so we can spot recordingId
 *  4. Also probe GET /recording/v1/recordings/{id}/content for any id we find
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
    if (!broker?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminToken = await getAdminGoToToken();
    if (!adminToken) return NextResponse.json({ error: "No admin GoTo token" }, { status: 424 });

    const { searchParams } = new URL(request.url);
    // Optional: pass ?userId=<uuid> to drill directly into a specific agent
    const targetUserId = searchParams.get("userId");

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 14);

    const results: Record<string, unknown>[] = [];

    // ── Step 1: user-activity summary — get userId UUIDs ──────────────────────
    let resolvedUserId = targetUserId;
    {
        const url = new URL("https://api.goto.com/call-reports/v1/reports/user-activity");
        url.searchParams.set("startTime", startTime.toISOString());
        url.searchParams.set("endTime", endTime.toISOString());
        url.searchParams.set("pageSize", "5");

        const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });
        const body = await resp.json().catch(() => null);

        const agents = (body?.items ?? []).map((u: Record<string, unknown>) => ({
            userId: u.userId,
            userName: u.userName,
            totalCallVolume: u.totalCallVolume,
        }));

        results.push({
            step: "1 — user-activity summary",
            httpStatus: resp.status,
            agentCount: agents.length,
            agents,
        });

        // Pick the first agent if no userId was passed
        if (!resolvedUserId && agents.length > 0) {
            resolvedUserId = agents[0].userId as string;
        }
    }

    // ── Step 2: user-activity detail — look for recordingId field ─────────────
    if (resolvedUserId) {
        const url = new URL(
            `https://api.goto.com/call-reports/v1/reports/user-activity/${encodeURIComponent(resolvedUserId)}`
        );
        url.searchParams.set("startTime", startTime.toISOString());
        url.searchParams.set("endTime", endTime.toISOString());
        url.searchParams.set("pageSize", "10");

        const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });
        const body = await resp.json().catch(() => null);

        const rawRecords: Record<string, unknown>[] = body?.items ?? [];

        // Show full raw fields so we can spot recordingId / transcriptEnabled / etc.
        const recordingSamples = rawRecords.slice(0, 5).map((r) => ({
            // spread everything — we need to see every field name
            ...r,
        }));

        // Check which records have recording-related fields
        const withRecordingId = rawRecords.filter(
            (r) => r.recordingId || r.transcriptEnabled !== undefined || r.hasRecording
        );

        results.push({
            step: `2 — user-activity detail (userId: ${resolvedUserId})`,
            httpStatus: resp.status,
            totalRecords: rawRecords.length,
            recordsWithRecordingId: withRecordingId.length,
            // First 5 full records — every field
            rawSamples: recordingSamples,
            recordingHits: withRecordingId.slice(0, 3),
        });

        // ── Step 3: if we found a recordingId, probe the recording endpoint ────
        const firstWithRecording = withRecordingId[0];
        if (firstWithRecording) {
            const recId = (firstWithRecording.recordingId ?? firstWithRecording.id) as string;
            const probeUrl = `https://api.goto.com/recording/v1/recordings/${encodeURIComponent(recId)}/content`;

            const probeResp = await fetch(probeUrl, {
                headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
            });
            const probeBody = await probeResp.json().catch(() => null);

            results.push({
                step: `3 — recording/v1/recordings/${recId}/content`,
                httpStatus: probeResp.status,
                body: probeBody,
            });
        }
    }

    return NextResponse.json({ results });
}
