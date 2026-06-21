/**
 * GET /api/goto/recording-download?id=<recordingId>&filename=<optional>
 *
 * Streams the audio content for a GoTo recording. Proxies the admin-token
 * call to /recording/v1/recordings/{id}/content so the browser can save the
 * file without ever seeing the access token.
 *
 * Auth: admin or sales_coach teamMember.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET(request: NextRequest) {
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
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Defense in depth: only allow safe id characters (GoTo IDs are alphanumeric + dashes/underscores)
    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const filenameParam = request.nextUrl.searchParams.get("filename") ?? `${id}.mp3`;
    // Sanitize filename — strip any path separators or quotes
    const safeFilename = filenameParam.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({ error: "GoTo admin token unavailable" }, { status: 424 });
    }

    const upstream = await fetch(
        `https://api.goto.com/recording/v1/recordings/${encodeURIComponent(id)}/content`,
        {
            headers: { Authorization: `Bearer ${adminToken}` },
        },
    );

    if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        console.error(`[recording-download] GoTo returned ${upstream.status}:`, errText);
        return NextResponse.json(
            { error: `GoTo upstream error: ${upstream.status}` },
            { status: upstream.status === 404 ? 404 : 502 },
        );
    }

    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
    const contentLength = upstream.headers.get("content-length") ?? undefined;

    const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "private, no-store",
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(upstream.body, { status: 200, headers });
}
