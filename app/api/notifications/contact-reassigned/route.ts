/**
 * API Route: Create Contact Reassignment Notifications
 * Server-side only - uses service role key safely
 * Creates in-app notification AND sends email notification
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-service";
import { generateContactReassignedEmail } from "@/lib/email-templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.ntsconnect.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newTeamMemberId, oldTeamMemberId, customerId, customerName, reassignedBy, reassignedByTeamMemberId } = body;

    if (!newTeamMemberId || !customerId || !customerName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Skip if reassigning to self (hyperfocused workspace principle)
    if (newTeamMemberId === reassignedByTeamMemberId) {
      console.log("Skipping self-reassignment notification (user knows what they did)");
      return NextResponse.json({ success: true, skipped: true });
    }

    // Create service-role client (server-side only)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch new teamMember information with email preferences
    const { data: teamMember, error: teamMemberError } = await supabase
      .from("team_members")
      .select(`
        id,
        email,
        first_name,
        last_name,
        user_preferences:user_preferences(
          email_notifications_enabled
        )
      `)
      .eq("id", newTeamMemberId)
      .eq("is_active", true)
      .single();

    if (teamMemberError || !teamMember) {
      console.error("Error fetching new team member:", teamMemberError);
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Notify ONLY the new teamMember (not the old teamMember - reduces noise)
    const { error } = await supabase.from("notifications").insert({
      team_member_id: newTeamMemberId,
      customer_id: customerId,
      type: "contact_reassigned",
      title: "Contact Reassigned to You",
      message: `${customerName} was reassigned to you by ${reassignedBy}`,
      is_read: false,
      is_archived: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error creating reassignment notification:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Send email notification if enabled
    const prefs = Array.isArray(teamMember.user_preferences)
      ? teamMember.user_preferences[0]
      : teamMember.user_preferences;

    if (prefs?.email_notifications_enabled) {
      const emailTemplate = generateContactReassignedEmail(
        teamMember.first_name || "there",
        customerName,
        reassignedBy,
        appUrl
      );

      await sendEmail({
        to: teamMember.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });

      console.log(`📧 Reassignment email notification sent to ${teamMember.email}`);
    }

    console.log(`✅ Created reassignment notification for new team member ${newTeamMemberId} (${customerName})`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to create contact reassignment notification:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
