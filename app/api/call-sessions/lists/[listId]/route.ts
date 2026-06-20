import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH /api/call-sessions/lists/[listId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.description === "string") updates.description = body.description;

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("dialer_lists")
        .update(updates)
        .eq("id", listId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ list: data });
}

// DELETE /api/call-sessions/lists/[listId]
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase.from("dialer_lists").delete().eq("id", listId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
