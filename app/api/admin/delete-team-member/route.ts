import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Admin client (service role) — bypasses RLS for the destructive cleanup
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    },
);

/**
 * POST /api/admin/delete-team-member
 *
 * Permanently deletes a system user (profile + auth.users row). Requires the
 * caller to be an active admin (`profiles.role = 'admin'`) and the request
 * body to include `confirmEmail` exactly matching the target's email.
 *
 * Deleting the auth user cascades the `profiles` row via the FK
 * `profiles.id references auth.users(id) on delete cascade`.
 *
 * Any linked `team_members` (broker) entity is left intact — `profiles.team_member_id`
 * is `on delete set null`, and the entity may still be referenced by historical
 * claim_party records. Reassigning or deleting a team_member entity is a
 * separate workflow.
 */
export async function POST(request: Request) {
    try {
        // ── 1. Authenticate caller and verify admin ────────────────────────────
        const authHeader = request.headers.get("authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) {
            return NextResponse.json(
                { error: "Missing Authorization header" },
                { status: 401 },
            );
        }

        const { data: userData, error: userError } =
            await supabaseAdmin.auth.getUser(token);
        if (userError || !userData?.user) {
            return NextResponse.json(
                { error: "Invalid or expired session" },
                { status: 401 },
            );
        }
        const callerId = userData.user.id;

        const { data: callerProfile, error: callerErr } = await supabaseAdmin
            .from("profiles")
            .select("role, is_active, email")
            .eq("id", callerId)
            .single();

        if (
            callerErr ||
            !callerProfile ||
            callerProfile.role !== "admin" ||
            callerProfile.is_active === false
        ) {
            return NextResponse.json(
                { error: "Only active admins can delete team members" },
                { status: 403 },
            );
        }

        // ── 2. Validate input ──────────────────────────────────────────────────
        const { teamMemberId, confirmEmail } = await request.json();
        if (!teamMemberId || typeof teamMemberId !== "string") {
            return NextResponse.json(
                { error: "teamMemberId is required" },
                { status: 400 },
            );
        }
        if (!confirmEmail || typeof confirmEmail !== "string") {
            return NextResponse.json(
                { error: "confirmEmail is required" },
                { status: 400 },
            );
        }

        if (teamMemberId === callerId) {
            return NextResponse.json(
                { error: "You cannot delete your own admin account from this UI" },
                { status: 400 },
            );
        }

        // ── 3. Look up the target profile and verify confirmEmail match ────────
        const { data: target, error: targetErr } = await supabaseAdmin
            .from("profiles")
            .select("id, email, first_name, last_name")
            .eq("id", teamMemberId)
            .single();

        if (targetErr || !target) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        const typed = confirmEmail.trim().toLowerCase();
        const actual = (target.email || "").trim().toLowerCase();
        if (typed !== actual) {
            return NextResponse.json(
                { error: "Email confirmation does not match" },
                { status: 400 },
            );
        }

        // ── 4. Delete the Supabase Auth user (cascades the profile row) ─────
        const { error: authDeleteErr } =
            await supabaseAdmin.auth.admin.deleteUser(teamMemberId);

        if (authDeleteErr) {
            console.error("[delete-team-member] auth.deleteUser error:", authDeleteErr);
            return NextResponse.json(
                {
                    error: `Failed to delete auth user: ${authDeleteErr.message}`,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            deletedTeamMember: {
                id: target.id,
                email: target.email,
                name: `${target.first_name ?? ""} ${target.last_name ?? ""}`.trim(),
            },
            // Kept for backward-compat with the table's success message renderer.
            customersReleased: 0,
            tasksReleased: 0,
            sourcesTagged: 0,
        });
    } catch (err) {
        console.error("[delete-team-member] unexpected error:", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error
                        ? err.message
                        : "Unexpected error deleting team member",
            },
            { status: 500 },
        );
    }
}
