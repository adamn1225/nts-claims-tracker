import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CONTACT_FIELDS = [
    "name", "company", "title", "phone", "email",
    "city", "state", "industry", "tags", "notes",
] as const;

// PATCH /api/call-sessions/contacts/[contactId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ contactId: string }> }
) {
    const { contactId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    for (const f of CONTACT_FIELDS) {
        if (body[f] !== undefined) updates[f] = body[f];
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("dialer_contacts")
        .update(updates)
        .eq("id", contactId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
}

// DELETE /api/call-sessions/contacts/[contactId]
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ contactId: string }> }
) {
    const { contactId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase.from("dialer_contacts").delete().eq("id", contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
