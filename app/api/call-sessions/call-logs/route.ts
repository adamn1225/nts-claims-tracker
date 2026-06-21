import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/call-sessions/call-logs
 * Body: {
 *   session_id, contact_id?, contact_snapshot,
 *   outcome?, notes?, goto_call_id?, duration_seconds?, follow_up_at?,
 *   pre_call_brief?, ai_feedback?
 * }
 *
 * PATCH /api/call-sessions/call-logs   -> update an existing log (e.g. attach AI feedback)
 * Body: { id, ...same fields }
 *
 * GET /api/call-sessions/call-logs?session_id=...   -> logs for a session
 */

const FIELDS = [
    "outcome", "notes", "goto_call_id", "duration_seconds", "follow_up_at",
    "pre_call_brief", "ai_feedback",
] as const;

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = request.nextUrl.searchParams.get("session_id");
    let q = supabase.from("dialer_call_logs").select("*").order("created_at", { ascending: false });
    if (sessionId) q = q.eq("session_id", sessionId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (!body.session_id || !body.contact_snapshot) {
        return NextResponse.json({ error: "session_id and contact_snapshot are required" }, { status: 400 });
    }

    const row: Record<string, unknown> = {
        team_member_id: user.id,
        session_id: body.session_id,
        contact_id: body.contact_id ?? null,
        contact_snapshot: body.contact_snapshot,
    };
    for (const f of FIELDS) {
        if (body[f] !== undefined) row[f] = body[f];
    }

    const { data, error } = await supabase
        .from("dialer_call_logs")
        .insert(row)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ log: data });
}

export async function PATCH(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    for (const f of FIELDS) {
        if (body[f] !== undefined) updates[f] = body[f];
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("dialer_call_logs")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ log: data });
}
