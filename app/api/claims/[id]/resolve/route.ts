import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimResolution = Database["public"]["Enums"]["claim_resolution"];

const RESOLUTIONS = new Set<ClaimResolution>([
    "paid_full",
    "paid_partial",
    "denied",
    "withdrawn",
    "recovered",
    "concession",
]);

const MIN_NOTE_LENGTH = 10;

/**
 * PATCH /api/claims/:id/resolve
 * Body: { action: "close" | "deny", resolution?: ClaimResolution, resolution_notes: string }
 *
 * Moves a claim out of the working kanban board into its Closed or Denied
 * status. A resolution note is mandatory here and additionally enforced by
 * the `claims_require_closure_note` DB trigger, so this is never bypassable.
 */
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

    const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();
    if (
        !profile ||
        profile.is_active === false ||
        !["admin", "manager", "claims_staff"].includes(profile.role)
    ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
        action?: "close" | "deny";
        resolution?: string;
        resolution_notes?: string;
    } | null;

    if (!body || (body.action !== "close" && body.action !== "deny")) {
        return NextResponse.json(
            { error: "action must be 'close' or 'deny'" },
            { status: 400 },
        );
    }

    const notes = body.resolution_notes?.trim() ?? "";
    if (notes.length < MIN_NOTE_LENGTH) {
        return NextResponse.json(
            {
                error: `Please add a brief explanation (at least ${MIN_NOTE_LENGTH} characters).`,
            },
            { status: 400 },
        );
    }

    const resolution = body.action === "deny" ? "denied" : body.resolution;
    if (!resolution || !RESOLUTIONS.has(resolution as ClaimResolution)) {
        return NextResponse.json(
            { error: "A valid resolution is required." },
            { status: 400 },
        );
    }
    if (body.action === "close" && resolution === "denied") {
        return NextResponse.json(
            { error: "Use the deny action for denied claims." },
            { status: 400 },
        );
    }

    // Resolve the destination status dynamically so renaming/reordering
    // statuses never breaks this action.
    const { data: statuses } = await supabase
        .from("claim_statuses")
        .select("id, is_closed, is_denied")
        .eq("is_active", true);

    const target = (statuses ?? []).find((s) =>
        body.action === "deny"
            ? s.is_closed && s.is_denied
            : s.is_closed && !s.is_denied,
    );
    if (!target) {
        return NextResponse.json(
            {
                error: `No active ${body.action === "deny" ? "denied" : "closed"} status is configured.`,
            },
            { status: 500 },
        );
    }

    const { data, error } = await supabase
        .from("claims")
        .update({
            status_id: target.id,
            resolution: resolution as ClaimResolution,
            resolution_notes: notes,
            closed_at: new Date().toISOString(),
        })
        .eq("id", claimId)
        .select("id, status_id, resolution, resolution_notes, closed_at")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ claim: data });
}
