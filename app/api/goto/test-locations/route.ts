/**
 * GET /api/goto/test-locations
 * 
 * Test endpoint to fetch GoTo locations (office locations)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken, getAdminNumericAccountKey } from "@/lib/goto-utils";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

    if (!broker?.is_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({ error: "No admin GoTo token" });
    }

    const numericAccountKey = await getAdminNumericAccountKey(adminToken);
    if (!numericAccountKey) {
        return NextResponse.json({ error: "Could not get account key" });
    }

    try {
        const url = new URL("https://api.goto.com/voice-admin/v1/locations");
        url.searchParams.set("accountKey", numericAccountKey);
        url.searchParams.set("pageSize", "100");

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${adminToken}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({
                error: `HTTP ${response.status}`,
                status: response.status,
                body: errorText,
            });
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            status: 200,
            accountKey: numericAccountKey,
            locations: data.items || [],
            totalLocations: (data.items || []).length,
            nextPageMarker: data.nextPageMarker || null,
            rawResponse: data,
        });
    } catch (err) {
        return NextResponse.json({
            error: String(err),
        });
    }
}
