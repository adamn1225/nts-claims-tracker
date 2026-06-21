/**
 * API v1 - SMS Campaign Contact Endpoint
 *
 * POST /api/v1/sms-campaign-contact
 *
 * Ingests a contact gathered during an SMS campaign conversation and routes it:
 *   - team_member_id provided  → assigned to that teamMember's Inbox (kanban board, status: "inbox")
 *   - team_member_id omitted/null → unassigned pool (Distribution Center, team_member_id: null)
 *
 * import_source is always set to "NTS SMS Campaign".
 *
 * Required scope: customers:create
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withApiAuth } from "@/lib/api-middleware";

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

const IMPORT_SOURCE = "NTS SMS Campaign";

export async function POST(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "customers",
    action: "create",
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { token, rateLimit, logRequest } = authResult;

  try {
    const body = await request.json();

    // Required field
    if (!body.business_name && !body.contact_name && !body.first_name) {
      await logRequest({ status: 400 }, "Missing required field: business_name or contact_name");
      return NextResponse.json(
        { error: "At least one of business_name, contact_name, or first_name is required" },
        { status: 400 },
      );
    }

    // Determine routing: assigned vs unassigned
    const hasTeamMember = body.team_member_id && typeof body.team_member_id === "string" && body.team_member_id.trim() !== "";

    if (hasTeamMember) {
      // Validate teamMember exists and is active
      const { data: teamMember, error: teamMemberLookupError } = await supabaseAdmin
        .from("team_members")
        .select("id, is_active")
        .eq("id", body.team_member_id.trim())
        .single();

      if (teamMemberLookupError || !teamMember) {
        await logRequest({ status: 404 }, "Team member not found");
        return NextResponse.json(
          { error: "Team member not found. Use GET /api/v1/team-members to retrieve valid team member IDs." },
          { status: 404 },
        );
      }

      if (!teamMember.is_active) {
        await logRequest({ status: 422 }, "TeamMember is inactive");
        return NextResponse.json(
          { error: "The specified team member is inactive and cannot receive new contacts." },
          { status: 422 },
        );
      }
    }

    // Strip routing/protected fields from body to prevent overrides
    const {
      team_member_id: _teamMemberId,
      status: _status,
      on_kanban_board: _onKanban,
      import_source: _importSource,
      id: _id,
      customer_id: _customerId,
      created_at: _createdAt,
      ...contactFields
    } = body;

    const now = new Date().toISOString();

    const customerData = hasTeamMember
      ? {
          ...contactFields,
          team_member_id: body.team_member_id.trim(),
          import_source: IMPORT_SOURCE,
          status: "inbox",
          on_kanban_board: true,
          created_at: now,
          updated_at: now,
        }
      : {
          ...contactFields,
          team_member_id: null,
          import_source: IMPORT_SOURCE,
          status: "unassigned",
          on_kanban_board: false,
          created_at: now,
          updated_at: now,
        };

    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert(customerData)
      .select()
      .single();

    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to create contact", details: error.message },
        { status: 500 },
      );
    }

    await logRequest({ status: 201, body: { data } });

    return NextResponse.json(
      {
        data,
        routed_to: hasTeamMember ? "broker_inbox" : "distribution_center",
        import_source: IMPORT_SOURCE,
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Limit": token.rate_limit_per_hour.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": rateLimit.resetAt,
        },
      },
    );
  } catch (error: any) {
    await logRequest({ status: 500 }, error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
