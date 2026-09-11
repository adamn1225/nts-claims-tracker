import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_PINNED = 10;

async function getMaxPinned(
    supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "max_pinned_claims")
        .maybeSingle();
    const n = Number(data?.value);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PINNED;
}

/**
 * POST /api/claims/:id/pin — pin a claim for the current user.
 * DELETE /api/claims/:id/pin — unpin.
 * PATCH /api/claims/:id/pin — body { swap_with: string }, swaps this claim's
 *   pin position with another pinned claim's, both owned by the current user.
 *
 * Pinning is per-user (`claim_pins`), not a claim-wide property.
 */
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: claimId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const [{ count }, maxPinned] = await Promise.all([
        supabase
            .from("claim_pins")
            .select("claim_id", { count: "exact", head: true })
            .eq("user_id", user.id),
        getMaxPinned(supabase),
    ]);

    if ((count ?? 0) >= maxPinned) {
        return NextResponse.json(
            { error: `You can pin up to ${maxPinned} claims. Unpin one first.` },
            { status: 400 },
        );
    }

    const { data: maxPosition } = await supabase
        .from("claim_pins")
        .select("position")
        .eq("user_id", user.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

    const { error } = await supabase.from("claim_pins").upsert(
        {
            user_id: user.id,
            claim_id: claimId,
            position: (maxPosition?.position ?? 0) + 1,
        },
        { onConflict: "user_id,claim_id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: claimId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { error } = await supabase
        .from("claim_pins")
        .delete()
        .eq("user_id", user.id)
        .eq("claim_id", claimId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: claimId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
        swap_with?: string;
    } | null;
    if (!body?.swap_with) {
        return NextResponse.json({ error: "swap_with is required" }, { status: 400 });
    }

    const { data: pins, error: fetchErr } = await supabase
        .from("claim_pins")
        .select("claim_id, position")
        .eq("user_id", user.id)
        .in("claim_id", [claimId, body.swap_with]);

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }
    const a = pins?.find((p) => p.claim_id === claimId);
    const b = pins?.find((p) => p.claim_id === body.swap_with);
    if (!a || !b) {
        return NextResponse.json(
            { error: "Both claims must already be pinned by you" },
            { status: 400 },
        );
    }

    const [{ error: err1 }, { error: err2 }] = await Promise.all([
        supabase
            .from("claim_pins")
            .update({ position: b.position })
            .eq("user_id", user.id)
            .eq("claim_id", a.claim_id),
        supabase
            .from("claim_pins")
            .update({ position: a.position })
            .eq("user_id", user.id)
            .eq("claim_id", b.claim_id),
    ]);

    if (err1 || err2) {
        return NextResponse.json(
            { error: err1?.message ?? err2?.message },
            { status: 400 },
        );
    }
    return NextResponse.json({ ok: true });
}
