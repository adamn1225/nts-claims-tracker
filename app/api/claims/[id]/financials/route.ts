import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_NAMES = [
    "damage_claim_amount",
    "shipment_value",
    "carrier_pay",
    "carrier_deductible",
] as const;

type FinancialField = (typeof FIELD_NAMES)[number];
type FinancialUpdate = Partial<Record<FinancialField, number | null>>;

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
        .select("role")
        .eq("id", user.id)
        .single();
    if (!profile || !["admin", "manager", "claims_staff"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const update: FinancialUpdate = {};
    for (const field of FIELD_NAMES) {
        if (!(field in body)) continue;
        const value = body[field];
        if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
            return NextResponse.json(
                { error: `${field} must be a non-negative number or null` },
                { status: 400 },
            );
        }
        update[field] = value as number | null;
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json(
            { error: "At least one financial field is required" },
            { status: 400 },
        );
    }

    const { data, error } = await supabase
        .from("claims")
        .update(update)
        .eq("id", claimId)
        .select(
            "id, damage_claim_amount, shipment_value, carrier_pay, carrier_deductible, currency, value_bucket",
        )
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ claim: data });
}