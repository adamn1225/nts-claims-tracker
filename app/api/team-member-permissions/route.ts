import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/team-member-permissions
 * Get permissions for a specific teamMember or all team members (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamMemberId = searchParams.get("teamMemberId");

    // Check if user is admin
    const { data: currentTeamMember } = await supabase
      .from("team_members")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!currentTeamMember?.is_admin && teamMemberId && teamMemberId !== user.id) {
      return NextResponse.json(
        { error: "Only admins can view other team members' permissions" },
        { status: 403 },
      );
    }

    // Get permissions
    let query = supabase.from("team_member_permissions").select("*");

    if (teamMemberId) {
      query = query.eq("team_member_id", teamMemberId);
      const { data, error } = await query.single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ permissions: data });
    } else {
      // Admin viewing all permissions
      if (!currentTeamMember?.is_admin) {
        return NextResponse.json(
          { error: "Only admins can view all permissions" },
          { status: 403 },
        );
      }
      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ permissions: data });
    }
  } catch (error) {
    console.error("Error in GET /api/team-member-permissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/team-member-permissions
 * Update permissions for a specific teamMember (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: currentTeamMember } = await supabase
      .from("team_members")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!currentTeamMember?.is_admin) {
      return NextResponse.json(
        { error: "Only admins can update permissions" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { teamMemberId, permissions } = body;

    if (!teamMemberId) {
      return NextResponse.json(
        { error: "teamMemberId is required" },
        { status: 400 },
      );
    }

    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json(
        { error: "permissions object is required" },
        { status: 400 },
      );
    }

    // Validate permissions object keys
    const validKeys = [
      "can_view_all_team_members",
      "can_view_office_team_members",
      "can_view_all_customers",
      "can_view_office_customers",
      "can_edit_own_customers",
      "can_edit_office_customers",
      "can_edit_all_customers",
      "can_view_all_tasks",
      "can_view_office_tasks",
      "can_edit_own_tasks",
      "can_edit_office_tasks",
      "can_edit_all_tasks",
      "can_manage_users",
      "can_manage_statuses",
      "can_manage_permissions",
      "can_export_data",
      "can_view_analytics",
      "can_invite_team_members",
      "can_invite_any_office",
      "can_manage_email_settings",
      "can_send_email_broadcasts",
      "can_use_ai_email",
      "can_access_power_dialer",
      "can_use_web_search",
      "can_manage_team",
    ];

    const invalidKeys = Object.keys(permissions).filter(
      (key) => !validKeys.includes(key),
    );

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Invalid permission keys: ${invalidKeys.join(", ")}` },
        { status: 400 },
      );
    }

    // Update permissions
    const { data, error } = await supabase
      .from("team_member_permissions")
      .update({
        ...permissions,
        updated_at: new Date().toISOString(),
      })
      .eq("team_member_id", teamMemberId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      permissions: data,
    });
  } catch (error) {
    console.error("Error in POST /api/team-member-permissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
