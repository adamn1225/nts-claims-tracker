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
 * POST /api/admin/delete-broker
 *
 * Permanently deletes a broker from both the `brokers` table AND Supabase Auth.
 * Requires the caller to be an active admin, and requires the request body to
 * include `confirmEmail` exactly matching the target broker's email.
 *
 * Any customers owned by the broker are reassigned to "limbo":
 *   - broker_id → NULL  (so they appear in the Unassigned/Limbo bucket)
 *   - on_kanban_board → false (they shouldn't sit on a deleted user's board)
 *   - import_source → 'unassigned' (only when previously NULL/empty, so we
 *     don't overwrite real import provenance like "Steel Companies 200")
 *
 * Tasks owned by the broker are also unassigned (broker_id → NULL) so they
 * don't cascade-delete with the broker row.
 *
 * Returns: { customersReleased, tasksReleased }
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

        const { data: callerBroker, error: callerErr } = await supabaseAdmin
            .from("brokers")
            .select("is_admin, is_active, email")
            .eq("id", callerId)
            .single();

        if (callerErr || !callerBroker?.is_admin || callerBroker.is_active === false) {
            return NextResponse.json(
                { error: "Only active admins can delete brokers" },
                { status: 403 },
            );
        }

        // ── 2. Validate input ──────────────────────────────────────────────────
        const { brokerId, confirmEmail } = await request.json();
        if (!brokerId || typeof brokerId !== "string") {
            return NextResponse.json(
                { error: "brokerId is required" },
                { status: 400 },
            );
        }
        if (!confirmEmail || typeof confirmEmail !== "string") {
            return NextResponse.json(
                { error: "confirmEmail is required" },
                { status: 400 },
            );
        }

        if (brokerId === callerId) {
            return NextResponse.json(
                { error: "You cannot delete your own admin account from this UI" },
                { status: 400 },
            );
        }

        // ── 3. Look up the target broker and verify confirmEmail match ────────
        const { data: target, error: targetErr } = await supabaseAdmin
            .from("brokers")
            .select("id, email, first_name, last_name")
            .eq("id", brokerId)
            .single();

        if (targetErr || !target) {
            return NextResponse.json(
                { error: "Broker not found" },
                { status: 404 },
            );
        }

        const typed = confirmEmail.trim().toLowerCase();
        const actual = target.email.trim().toLowerCase();
        if (typed !== actual) {
            return NextResponse.json(
                { error: "Email confirmation does not match" },
                { status: 400 },
            );
        }

        // ── 4. Release customers into limbo ────────────────────────────────────
        // Two updates so we never overwrite a real import_source:
        //   a) Customers without a source → set to 'unassigned'
        //   b) All of this broker's customers → broker_id NULL, off kanban
        const now = new Date().toISOString();

        const { data: blankSourceRows, error: blankErr } = await supabaseAdmin
            .from("customers")
            .update({ import_source: "unassigned", updated_at: now })
            .eq("broker_id", brokerId)
            .or("import_source.is.null,import_source.eq.")
            .select("id");

        if (blankErr) {
            // Non-fatal: this step is purely cosmetic (so the customers show up
            // in "Unassigned" filters). If the column is missing from PostgREST's
            // schema cache, or anything else goes wrong, just warn and continue —
            // the actual unassign happens in the next step.
            console.warn("[delete-broker] tag-unassigned warning (non-fatal):", blankErr.message);
        }

        const { data: releasedCustomers, error: releaseErr } = await supabaseAdmin
            .from("customers")
            .update({
                broker_id: null,
                on_kanban_board: false,
                updated_at: now,
            })
            .eq("broker_id", brokerId)
            .select("id");

        if (releaseErr) {
            console.error("[delete-broker] release-customers error:", releaseErr);
            return NextResponse.json(
                { error: `Failed to release customers: ${releaseErr.message}` },
                { status: 500 },
            );
        }

        // ── 5. Release tasks (so they don't cascade-delete with the broker) ───
        const { data: releasedTasks, error: tasksErr } = await supabaseAdmin
            .from("tasks")
            .update({ broker_id: null, updated_at: now })
            .eq("broker_id", brokerId)
            .select("id");

        if (tasksErr) {
            // Non-fatal: if tasks have NOT NULL we just let them cascade.
            console.warn("[delete-broker] release-tasks warning:", tasksErr.message);
        }

        // ── 6. Delete the broker row (cascades preferences, permissions, etc.) ─
        const { error: deleteBrokerErr } = await supabaseAdmin
            .from("brokers")
            .delete()
            .eq("id", brokerId);

        if (deleteBrokerErr) {
            console.error("[delete-broker] delete-broker-row error:", deleteBrokerErr);
            return NextResponse.json(
                { error: `Failed to delete broker row: ${deleteBrokerErr.message}` },
                { status: 500 },
            );
        }

        // ── 7. Delete the Supabase Auth user ──────────────────────────────────
        const { error: authDeleteErr } =
            await supabaseAdmin.auth.admin.deleteUser(brokerId);

        if (authDeleteErr) {
            console.error("[delete-broker] auth.deleteUser error:", authDeleteErr);
            // The broker row is already gone, so the account is unusable. Report a
            // partial-success so the admin can investigate the dangling auth user.
            return NextResponse.json(
                {
                    warning: `Broker data deleted, but the auth user could not be removed: ${authDeleteErr.message}. Please delete it manually from Supabase Auth.`,
                    customersReleased: releasedCustomers?.length ?? 0,
                    tasksReleased: releasedTasks?.length ?? 0,
                    sourcesTagged: blankSourceRows?.length ?? 0,
                },
                { status: 207 },
            );
        }

        return NextResponse.json({
            success: true,
            deletedBroker: {
                id: target.id,
                email: target.email,
                name: `${target.first_name ?? ""} ${target.last_name ?? ""}`.trim(),
            },
            customersReleased: releasedCustomers?.length ?? 0,
            tasksReleased: releasedTasks?.length ?? 0,
            sourcesTagged: blankSourceRows?.length ?? 0,
        });
    } catch (err) {
        console.error("[delete-broker] unexpected error:", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error
                        ? err.message
                        : "Unexpected error deleting broker",
            },
            { status: 500 },
        );
    }
}
