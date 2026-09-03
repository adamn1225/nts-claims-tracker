import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_TYPES } from "@/lib/constants/claim-types";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimUpdate = Database["public"]["Tables"]["claims"]["Update"];

const CLAIM_TYPE_VALUES = new Set<string>(CLAIM_TYPES.map(({ value }) => value));
const VALUE_BUCKET_VALUES = new Set(["current", "credit_high_value", "legal"]);
const RESOLUTION_VALUES = new Set([
    "paid_full",
    "paid_partial",
    "denied",
    "withdrawn",
    "recovered",
    "concession",
]);

class ValidationError extends Error { }

function nullableText(
    body: Record<string, unknown>,
    field: string,
    maxLength: number,
): string | null {
    const value = body[field];
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") throw new ValidationError(`${field} must be text`);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
        throw new ValidationError(`${field} cannot exceed ${maxLength} characters`);
    }
    return trimmed || null;
}

function nullableAmount(body: Record<string, unknown>, field: string): number | null {
    const value = body[field];
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new ValidationError(`${field} must be a non-negative number or null`);
    }
    return Math.round(value * 100) / 100;
}

function nullableDate(body: Record<string, unknown>, field: string): string | null {
    const value = body[field];
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ValidationError(`${field} must be a date in YYYY-MM-DD format`);
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new ValidationError(`${field} must be a valid date`);
    }
    return value;
}

function nullableUuid(body: Record<string, unknown>, field: string): string | null {
    const value = body[field];
    if (value === null || value === undefined || value === "") return null;
    if (
        typeof value !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
        throw new ValidationError(`${field} must be a valid identifier`);
    }
    return value;
}

export async function PATCH(
    request: Request,
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

    let body: Record<string, unknown>;
    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const claimType = nullableText(body, "claim_type", 50);
        const resolution = nullableText(body, "resolution", 50);
        const valueBucket = nullableText(body, "value_bucket", 50);
        const valueBucketManual = body.value_bucket_manual;
        const currency = nullableText(body, "currency", 3)?.toUpperCase() ?? "USD";
        const statusId = nullableUuid(body, "status_id");

        if (claimType && !CLAIM_TYPE_VALUES.has(claimType)) {
            throw new ValidationError("Invalid claim type");
        }
        if (resolution && !RESOLUTION_VALUES.has(resolution)) {
            throw new ValidationError("Invalid resolution");
        }
        if (!valueBucket || !VALUE_BUCKET_VALUES.has(valueBucket)) {
            throw new ValidationError("Invalid value bucket");
        }
        if (typeof valueBucketManual !== "boolean") {
            throw new ValidationError("value_bucket_manual must be true or false");
        }
        if (!/^[A-Z]{3}$/.test(currency)) {
            throw new ValidationError("currency must be a three-letter code");
        }
        if (!statusId) {
            throw new ValidationError("A claim status is required");
        }

        const { data: targetStatus } = await supabase
            .from("claim_statuses")
            .select("id")
            .eq("id", statusId)
            .eq("is_active", true)
            .maybeSingle();
        if (!targetStatus) {
            throw new ValidationError("Claim status must be active");
        }

        const update: ClaimUpdate = {
            status_id: statusId,
            summary: nullableText(body, "summary", 500),
            claim_type: claimType as ClaimUpdate["claim_type"],
            value_bucket: valueBucket as ClaimUpdate["value_bucket"],
            value_bucket_manual: valueBucketManual,
            tms_order_number: nullableText(body, "tms_order_number", 100),
            bol_number: nullableText(body, "bol_number", 100),
            freight_type_id: nullableUuid(body, "freight_type_id"),
            trailer_type_id: nullableUuid(body, "trailer_type_id"),
            origin_city: nullableText(body, "origin_city", 100),
            origin_state: nullableText(body, "origin_state", 2)?.toUpperCase() ?? null,
            origin_postal_code: nullableText(body, "origin_postal_code", 10),
            destination_city: nullableText(body, "destination_city", 100),
            destination_state:
                nullableText(body, "destination_state", 2)?.toUpperCase() ?? null,
            destination_postal_code: nullableText(body, "destination_postal_code", 10),
            pickup_date: nullableDate(body, "pickup_date"),
            delivery_date: nullableDate(body, "delivery_date"),
            incident_date: nullableDate(body, "incident_date"),
            damage_claim_amount: nullableAmount(body, "damage_claim_amount"),
            shipment_value: nullableAmount(body, "shipment_value"),
            carrier_pay: nullableAmount(body, "carrier_pay"),
            carrier_deductible: nullableAmount(body, "carrier_deductible"),
            currency,
            internal_description: nullableText(body, "internal_description", 10_000),
            resolution: resolution as ClaimUpdate["resolution"],
            resolution_notes: nullableText(body, "resolution_notes", 10_000),
            last_activity_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from("claims")
            .update(update)
            .eq("id", claimId)
            .select("*")
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ claim: data });
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error("[claim details] update failed", error);
        return NextResponse.json({ error: "Unable to update claim" }, { status: 500 });
    }
}