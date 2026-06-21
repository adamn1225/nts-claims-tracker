/**
 * API v1 - TeamMembers Endpoint
 *
 * GET /api/v1/team-members - List active team member profiles (for customer assignment in external integrations)
 *
 * Returns safe, non-sensitive fields only. Use the returned teamMember `id` as `team_member_id`
 * when creating or updating customers via POST /api/v1/customers.
 *
 * Query params:
 *   ?office_location=Dallas   - filter by office location (partial match)
 *   ?search=john              - search first_name, last_name, or email
 *   ?include_inactive=true    - include inactive teamMembers (default: false)
 *
 * Required scope: teamMembers:read
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

/**
 * GET /api/v1/team-members
 * Returns active team member profiles for use in customer assignment.
 * Sensitive fields (is_admin, is_manager, phone) are excluded.
 */
export async function GET(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "teamMembers",
    action: "read",
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { token, rateLimit, logRequest } = authResult;

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const officeLocation = searchParams.get("office_location");
    const search = searchParams.get("search");
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Only expose fields needed for customer assignment — never admin flags
    let query = supabaseAdmin
      .from("team_members")
      .select("id, first_name, last_name, email, office_location, territory, is_active")
      .order("first_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (officeLocation) {
      query = query.ilike("office_location", `%${officeLocation}%`);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to fetch team members", details: error.message },
        { status: 500 },
      );
    }

    const response = { data };

    await logRequest({ status: 200, body: response });

    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Limit": token.rate_limit_per_hour.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.resetAt,
      },
    });
  } catch (error: any) {
    await logRequest({ status: 500 }, error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
