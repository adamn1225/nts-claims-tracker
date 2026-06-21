import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Default Kanban columns per the CEO's email spec.
 * Inbox is NOT seeded here — it is injected by the app as a protected
 * virtual column (see components/KanbanBoard.tsx, where `inboxStatus` is
 * prepended with `is_protected: true`). Only the 5 working stages live in
 * the customer_statuses table.
 */
const DEFAULT_CLAIM_COLUMNS: Array<{ name: string; color: string; order: number }> = [
  { name: "Claim Started",          color: "blue",   order: 0 },
  { name: "Processing Claim",       color: "amber",  order: 1 },
  { name: "Claim Denied",           color: "red",    order: 2 },
  { name: "Claim Awaiting Payment", color: "orange", order: 3 },
  { name: "Claim Closed",           color: "green",  order: 4 },
];

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!teamMember?.is_admin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { user };
}

/**
 * POST /api/admin/reset-columns
 *
 * Body: { teamMemberId?: string, scope?: "one" | "all" }
 *
 * Admin-only. Deletes the target teamMember's rows in `customer_statuses` and
 * re-seeds the CEO's 5 default kanban columns. Cards previously in deleted
 * columns are not destroyed — `customer_status_id` is ON DELETE SET NULL,
 * so they fall back into the protected Inbox column in the UI.
 *
 * Uses the service-role client to bypass RLS, since admins may need to
 * reset columns for other team members.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: { teamMemberId?: string; scope?: "one" | "all" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scope = body.scope ?? "one";

  if (scope === "one" && !body.teamMemberId) {
    return NextResponse.json(
      { error: "teamMemberId is required when scope is 'one'" },
      { status: 400 },
    );
  }

  // Service-role client — needed to mutate other team members' rows when admins
  // are resetting on someone else's behalf.
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Service role not configured on the server" },
      { status: 500 },
    );
  }
  const admin = createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve which teamMember IDs to reset.
  let teamMemberIds: string[];
  if (scope === "all") {
    const { data: allTeamMembers, error: teamMembersErr } = await admin
      .from("team_members")
      .select("id");
    if (teamMembersErr) {
      return NextResponse.json(
        { error: `Failed to list users: ${teamMembersErr.message}` },
        { status: 500 },
      );
    }
    teamMemberIds = (allTeamMembers ?? []).map((b) => b.id);
  } else {
    teamMemberIds = [body.teamMemberId!];
  }

  if (teamMemberIds.length === 0) {
    return NextResponse.json({
      ok: true,
      resetCount: 0,
      message: "No team members to reset.",
    });
  }

  // Wipe existing columns for the target teamMembers in a single statement.
  const { error: deleteErr } = await admin
    .from("customer_statuses")
    .delete()
    .in("team_member_id", teamMemberIds);
  if (deleteErr) {
    return NextResponse.json(
      { error: `Failed to clear existing columns: ${deleteErr.message}` },
      { status: 500 },
    );
  }

  // Re-seed defaults for every target teamMember. `created_by` is the team member
  // themselves so the rows look identical to first-time-seed rows the
  // KanbanBoard would have created.
  const rowsToInsert = teamMemberIds.flatMap((teamMemberId) =>
    DEFAULT_CLAIM_COLUMNS.map((col) => ({
      team_member_id: teamMemberId,
      name: col.name,
      color: col.color,
      order: col.order,
      is_system: false,
      created_by: teamMemberId,
    })),
  );

  const { error: insertErr } = await admin
    .from("customer_statuses")
    .insert(rowsToInsert);
  if (insertErr) {
    return NextResponse.json(
      {
        error: `Failed to seed default columns: ${insertErr.message}`,
        partial: true,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    resetCount: teamMemberIds.length,
    columnsPerTeamMember: DEFAULT_CLAIM_COLUMNS.length,
  });
}
