/**
 * API Route: Create Contact Assignment Notifications
 * Server-side only - uses service role key safely
 * Creates in-app notification AND sends email notification
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-service";
import {
  generateContactAssignedEmail,
  generateBatchContactAssignedEmail,
} from "@/lib/email-templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.ntsconnect.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamMemberId, customerIds, customerNames, assignedBy, assignedByTeamMemberId } = body;

    if (!teamMemberId || !customerIds || !Array.isArray(customerIds)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create service-role client (server-side only)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const count = customerIds.length;

    // Skip if assigning to self (hyperfocused workspace principle)
    if (teamMemberId === assignedByTeamMemberId) {
      console.log("Skipping self-assignment notification (user knows what they did)");
      return NextResponse.json({ success: true, skipped: true });
    }

    // Fetch teamMember information with email preferences
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
      .eq("id", teamMemberId)
      .eq("is_active", true)
      .single();

    if (teamMemberError || !teamMember) {
      console.error("Error fetching team member:", teamMemberError);
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Create one notification for single or multiple contacts
    if (count === 1) {
      const { error } = await supabase.from("notifications").insert({
        team_member_id: teamMemberId,
        customer_id: customerIds[0],
        type: "contact_assigned",
        title: "New Contact Assigned",
        message: `${customerNames[0]} was assigned to you by ${assignedBy}`,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error creating notification:", error);
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
        const emailTemplate = generateContactAssignedEmail(
          teamMember.first_name || "there",
          customerNames[0],
          assignedBy,
          appUrl
        );

        await sendEmail({
          to: teamMember.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });

        console.log(`📧 Email notification sent to ${teamMember.email}`);
      }
    } else {
      // Batch assignment - create single notification
      const { error } = await supabase.from("notifications").insert({
        team_member_id: teamMemberId,
        type: "contact_assigned",
        title: "New Contacts Assigned",
        message: `${count} contacts were assigned to you by ${assignedBy}`,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error creating batch notification:", error);
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
        const emailTemplate = generateBatchContactAssignedEmail(
          teamMember.first_name || "there",
          count,
          assignedBy,
          appUrl
        );

        await sendEmail({
          to: teamMember.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });

        console.log(`📧 Batch email notification sent to ${teamMember.email}`);
      }
    }

    console.log(`✅ Created assignment notification for team member ${teamMemberId} (${count} contacts)`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to create contact assignment notification:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
