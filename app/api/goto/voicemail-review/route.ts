/**
 * GET /api/goto/voicemail-review
 *
 * Admin-only. Fetches voicemails for all org users using the admin token,
 * then enriches with transcriptions (up to 5 per user).
 *
 * Uses fetchGoToVoicemailsForUser (with userKey) + enrichVoicemailTranscriptions
 * from goto-utils.ts, proxied through the admin token.
 *
 * Query params:
 *   days  — lookback window in days (default: 7, max: 30)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    getAdminGoToToken,
    getAdminNumericAccountKey,
    fetchGoToOrgUsers,
    enrichVoicemailTranscriptions,
    GoToVoicemail,
} from "@/lib/goto-utils";

interface VoicemailEntry {
    userName: string;
    received: string;
    duration: number;
    caller: { number: string; name?: string };
    transcription?: string;
    heard: boolean;
}

/**
 * Fetch voicemails for a single user by their PBX extension number.
 * The GoTo voicemailboxes API accepts `extensionNumber` (not `userKey`) as a filter.
 * Returns empty array on any failure (voicemail may not be provisioned for all users).
 */
async function fetchVoicemailsForUserKey(
    adminToken: string,
    extensionNumber: string,
    accountKey: string,
    lookbackDays: number,
): Promise<GoToVoicemail[]> {
    try {
        const vmboxUrl = new URL("https://api.goto.com/voicemail/v1/voicemailboxes");
        vmboxUrl.searchParams.set("accountKey", accountKey);
        vmboxUrl.searchParams.set("extensionNumber", extensionNumber);

        const vmboxResp = await fetch(vmboxUrl.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });

        if (!vmboxResp.ok) return [];

        const vmboxData = await vmboxResp.json();
        const voicemailboxId: string | undefined =
            vmboxData?.items?.[0]?.id ?? vmboxData?.[0]?.id;

        if (!voicemailboxId) return [];

        const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
        const cutoff = new Date(since);

        const vmUrl = new URL(
            `https://api.goto.com/voicemail/v1/voicemailboxes/${voicemailboxId}/voicemails`,
        );
        vmUrl.searchParams.set("pageSize", "25");

        const vmResp = await fetch(vmUrl.toString(), {
            headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
        });

        if (!vmResp.ok) return [];

        const vmData = await vmResp.json();
        // Normalise: GoTo API returns `timestamp` but our interface uses `received`
        const all: GoToVoicemail[] = (vmData?.items ?? []).map((item: any) => ({
            ...item,
            received: item.timestamp ?? item.received ?? "",
        }));

        return all.filter((vm) => new Date(vm.received) >= cutoff);
    } catch {
        return [];
    }
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: teamMember } = await supabase
        .from("team_members")
        .select("is_admin, is_sales_coach")
        .eq("id", user.id)
        .maybeSingle();

    const hasAccess = Boolean(teamMember?.is_admin || (teamMember as { is_sales_coach?: boolean })?.is_sales_coach);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));

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

    // Get all active org users (uses the numeric userKey we need for voicemailboxes endpoint)
    const orgUsers = await fetchGoToOrgUsers(adminToken, numericAccountKey);
    const activeUsers = orgUsers.filter((u) => u.key && u.status?.toUpperCase() !== "SUSPENDED");

    // Only process users that have a PBX extension — required for voicemailboxes API filter
    const usersWithExtension = activeUsers.filter((u) => u.extension);

    const allVoicemails: VoicemailEntry[] = [];

    // Fetch voicemails per user — batched 5 at a time to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < usersWithExtension.length; i += BATCH_SIZE) {
        const batch = usersWithExtension.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
            batch.map((u) => fetchVoicemailsForUserKey(adminToken, u.extension!, numericAccountKey, days)),
        );

        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const orgUser = batch[j];
            if (result.status !== "fulfilled" || result.value.length === 0) continue;

            // Enrich first 5 voicemails per user with transcription
            const enriched = await enrichVoicemailTranscriptions(adminToken, result.value);

            const userName = `${orgUser.firstName ?? ""} ${orgUser.lastName ?? ""}`.trim() || orgUser.email;

            for (const vm of enriched) {
                allVoicemails.push({
                    userName,
                    received: vm.received,
                    duration: vm.duration,
                    caller: vm.caller,
                    transcription: vm.transcription,
                    heard: vm.heard,
                });
            }
        }

        if (i + BATCH_SIZE < usersWithExtension.length) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    // Sort newest first
    allVoicemails.sort((a, b) => new Date(b.received).getTime() - new Date(a.received).getTime());

    return NextResponse.json({
        days,
        usersChecked: activeUsers.length,
        usersWithVoicemail: usersWithExtension.length,
        voicemails: allVoicemails,
    });
}
