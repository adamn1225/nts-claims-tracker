/**
 * GET /api/goto/check-scopes
 * 
 * Debugging endpoint to see what OAuth scopes the admin token has
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: teamMember } = await supabase
        .from("team_members")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

    if (!teamMember?.is_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the admin token from database
    const { data: connection } = await supabase
        .from("goto_connections")
        .select("access_token, created_at, updated_at")
        .eq("is_admin_token", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!connection) {
        return NextResponse.json({
            hasToken: false,
            message: "No admin GoTo connection found. Visit /api/goto/auth?admin=true to connect.",
        });
    }

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({
            hasToken: false,
            message: "Could not decrypt admin token",
        });
    }

    // Call GoTo's /me endpoint to see token info
    try {
        const meResponse = await fetch("https://api.goto.com/users/v1/me", {
            headers: {
                Authorization: `Bearer ${adminToken}`,
                Accept: "application/json",
            },
        });

        const meData = meResponse.ok ? await meResponse.json() : null;

        // Try to introspect the token (if GoTo supports it)
        // Note: Most OAuth providers don't expose scopes via user-facing APIs
        // The scopes are embedded in the JWT token itself

        // Decode JWT to see scopes (assuming it's a JWT)
        const tokenParts = adminToken.split('.');
        let decodedToken = null;
        let scopes: string[] = [];

        if (tokenParts.length === 3) {
            try {
                // Decode the payload (second part)
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                decodedToken = payload;

                // GoTo might store scopes in 'scope' or 'scopes' field
                if (payload.scope) {
                    scopes = typeof payload.scope === 'string'
                        ? payload.scope.split(' ')
                        : payload.scope;
                } else if (payload.scopes) {
                    scopes = Array.isArray(payload.scopes)
                        ? payload.scopes
                        : payload.scopes.split(' ');
                }
            } catch (err) {
                console.error("Failed to decode JWT:", err);
            }
        }

        return NextResponse.json({
            hasToken: true,
            tokenCreated: connection.created_at,
            tokenUpdated: connection.updated_at,
            meEndpoint: {
                status: meResponse.status,
                success: meResponse.ok,
                data: meData,
            },
            tokenInfo: {
                isJWT: tokenParts.length === 3,
                decodedPayload: decodedToken,
                detectedScopes: scopes.length > 0 ? scopes : null,
            },
            availableContactCenterScopes: [
                "cc-analytics.v1.agent-status.read (you have this)",
                "queue-caller.v1.read (you have this)",
                "contact-center-analytics.v1.read (TRYING - might not exist)",
                "cc-analytics.v1.read (ALTERNATIVE - might be the right one)",
            ],
            nextSteps: [
                "1. Check if your scopes are listed above",
                "2. If not, the token might not be a standard JWT",
                "3. Check GoTo developer console to see available scopes for your OAuth app",
                "4. The Contact Center Analytics endpoints might require a paid add-on license",
            ],
        });
    } catch (err) {
        return NextResponse.json({
            error: String(err),
            hasToken: true,
        });
    }
}
