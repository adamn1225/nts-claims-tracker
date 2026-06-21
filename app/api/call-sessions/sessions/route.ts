import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/call-sessions/sessions      -> start a new session
 * Body: { listId?: string, mode: 'saved' | 'ephemeral', contactsSnapshot?: any[] }
 *
 * PATCH /api/call-sessions/sessions     -> end / update session stats
 * Body: { id, ended_at?, total_calls?, total_connected? }
 */

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "ephemeral" ? "ephemeral" : "saved";

    const insert: Record<string, unknown> = {
        team_member_id: user.id,
        mode,
        list_id: body.listId ?? null,
    };
    if (mode === "ephemeral" && Array.isArray(body.contactsSnapshot)) {
        insert.contacts_snapshot = body.contactsSnapshot;
    }

    const { data, error } = await supabase
        .from("dialer_sessions")
        .insert(insert)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
}

export async function PATCH(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id: string | undefined = body.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.ended_at !== undefined) updates.ended_at = body.ended_at;
    if (typeof body.total_calls === "number") updates.total_calls = body.total_calls;
    if (typeof body.total_connected === "number") updates.total_connected = body.total_connected;

    const { data, error } = await supabase
        .from("dialer_sessions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
}
