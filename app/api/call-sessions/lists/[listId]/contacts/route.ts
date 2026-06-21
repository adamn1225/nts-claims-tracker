import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CONTACT_FIELDS = [
    "name", "company", "title", "phone", "email",
    "city", "state", "industry", "tags", "notes",
] as const;

function sanitizeContact(input: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const f of CONTACT_FIELDS) {
        if (input[f] !== undefined) out[f] = input[f];
    }
    return out;
}

// GET /api/call-sessions/lists/[listId]/contacts
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
        .from("dialer_contacts")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contacts: data ?? [] });
}

// POST /api/call-sessions/lists/[listId]/contacts
// Accepts a single contact or { contacts: Contact[] } for bulk
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const items: Record<string, unknown>[] = Array.isArray(body.contacts)
        ? body.contacts
        : [body];

    const rows = items
        .map(sanitizeContact)
        .filter((r) => typeof r.name === "string" && (r.name as string).trim().length > 0)
        .map((r) => ({ ...r, list_id: listId, team_member_id: user.id }));

    if (rows.length === 0) {
        return NextResponse.json({ error: "No valid contacts" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("dialer_contacts")
        .insert(rows)
        .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contacts: data ?? [], inserted: data?.length ?? 0 });
}
