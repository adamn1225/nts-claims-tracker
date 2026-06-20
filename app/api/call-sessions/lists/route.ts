import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/call-sessions/lists  -> all lists for current broker (with counts)
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: lists, error } = await supabase
        .from("dialer_lists")
        .select("*")
        .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Count contacts per list
    const ids = (lists ?? []).map((l) => l.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
        const { data: cs } = await supabase
            .from("dialer_contacts")
            .select("list_id")
            .in("list_id", ids);
        counts = (cs ?? []).reduce<Record<string, number>>((acc, c) => {
            acc[c.list_id] = (acc[c.list_id] ?? 0) + 1;
            return acc;
        }, {});
    }

    return NextResponse.json({
        lists: (lists ?? []).map((l) => ({ ...l, contact_count: counts[l.id] ?? 0 })),
    });
}

// POST /api/call-sessions/lists  -> create new list
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const { data, error } = await supabase
        .from("dialer_lists")
        .insert({
            broker_id: user.id,
            name,
            description: body.description ?? null,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ list: data });
}
