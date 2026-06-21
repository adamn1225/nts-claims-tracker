/**
 * POST /api/goto/call-search
 *
 * Searches GoTo recordings across the entire org by participant phone number
 * and date range. Used by the Performance dashboard "Call Search" tab as a
 * convenience replacement for the GoTo Call Reports UI when teamMembers request
 * recordings/transcripts for a specific phone number.
 *
 * Request body:
 *   phone:        string           — Phone number fragment to match (any format)
 *   startDate:    string (ISO)     — Inclusive start
 *   endDate:      string (ISO)     — Inclusive end
 *   includeTranscripts?: boolean   — Fetch transcript text inline (default true)
 *
 * Auth: admin or sales_coach teamMember.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    getAdminGoToToken,
    searchGoToRecordingsByPhone,
    enrichRecordingTranscripts,
} from "@/lib/goto-utils";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerTeamMember } = await supabase
        .from("team_members")
        .select("is_admin, is_sales_coach")
        .eq("id", user.id)
        .maybeSingle();

    const hasCoachAccess = Boolean(
        callerTeamMember?.is_admin || (callerTeamMember as { is_sales_coach?: boolean } | null)?.is_sales_coach
    );

    if (!hasCoachAccess) {
        return NextResponse.json({ error: "Forbidden - Admin or sales coach access required" }, { status: 403 });
    }

    let phone = "";
    let startDate = "";
    let endDate = "";
    let includeTranscripts = true;

    try {
        const body = await request.json();
        phone = String(body.phone ?? "").trim();
        startDate = String(body.startDate ?? "").trim();
        endDate = String(body.endDate ?? "").trim();
        if (body.includeTranscripts === false) includeTranscripts = false;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    // Validate date range parses + endDate >= startDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: "Invalid startDate or endDate" }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
        return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
    }

    // Cap window to 90 days to keep the search bounded
    const maxWindowMs = 90 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxWindowMs) {
        return NextResponse.json({ error: "Date range cannot exceed 90 days" }, { status: 400 });
    }

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({
            error: "GoTo admin token unavailable",
            details: "No admin GoTo connection found. Re-authenticate via the GoTo button.",
        }, { status: 424 });
    }

    const phoneDigits = phone.replace(/\D/g, "");

    const recordings = await searchGoToRecordingsByPhone(
        adminToken,
        phoneDigits,
        start.toISOString(),
        end.toISOString(),
        200,
    );

    let enriched = recordings;
    if (includeTranscripts && recordings.some((r) => r.hasTranscript)) {
        enriched = await enrichRecordingTranscripts(adminToken, recordings);
    }

    return NextResponse.json({
        total: enriched.length,
        recordings: enriched,
    });
}
