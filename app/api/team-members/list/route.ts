/**
 * GET /api/team-members/list
 * 
 * Returns list of all active team members with their details for autocomplete/selection
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();

  try {
    // Fetch all active team members from broker_customer_summary view
    const { data: teamMembers, error } = await supabase
      .from("broker_customer_summary")
      .select("team_member_id, full_name, office_location, active_customers, total_customers")
      .order("full_name");

    if (error) throw error;

    // Format for frontend autocomplete
    const formattedTeamMembers = teamMembers?.map(b => ({
      id: b.team_member_id,
      name: b.full_name || "Unknown",
      office: b.office_location || "N/A",
      customers: b.active_customers || 0,
    })) || [];

    return NextResponse.json({ 
      teamMembers: formattedTeamMembers,
      count: formattedTeamMembers.length 
    });
  } catch (error: any) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members", details: error.message },
      { status: 500 }
    );
  }
}
