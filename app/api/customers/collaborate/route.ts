import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-service";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sales.ntsconnect.com";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get current team member details
        const { data: currentTeamMember, error: teamMemberError } = await supabase
            .from("team_members")
            .select("*")
            .eq("id", user.id)
            .single();

        if (teamMemberError || !currentTeamMember) {
            return NextResponse.json(
                { error: "TeamMember profile not found" },
                { status: 404 }
            );
        }

        // Parse request body
        const { customerId, customerName, teamMemberIds, mode, message } = await req.json();

        if (!customerId || !teamMemberIds || !Array.isArray(teamMemberIds) || teamMemberIds.length === 0) {
            return NextResponse.json(
                { error: "Invalid request: customerId and teamMemberIds are required" },
                { status: 400 }
            );
        }

        if (mode && !["team_up", "notify_only"].includes(mode)) {
            return NextResponse.json(
                { error: "Invalid mode: must be 'team_up' or 'notify_only'" },
                { status: 400 }
            );
        }

        const collaborationMode = mode || "team_up";

        // Verify current user has access to this customer
        const { data: customer, error: customerError } = await supabase
            .from("customers")
            .select("id, business_name, customer_id, team_member_id")
            .eq("id", customerId)
            .single();

        if (customerError || !customer) {
            return NextResponse.json(
                { error: "Customer not found" },
                { status: 404 }
            );
        }

        // Check if user is admin, manager, or owns the customer
        const canShare =
            currentTeamMember.is_admin ||
            currentTeamMember.is_manager ||
            customer.team_member_id === currentTeamMember.id;

        if (!canShare) {
            return NextResponse.json(
                { error: "You don't have permission to collaborate on this customer" },
                { status: 403 }
            );
        }

        // Fetch recipient teamMember details
        const { data: recipients, error: recipientsError } = await supabase
            .from("team_members")
            .select("id, first_name, last_name, email")
            .in("id", teamMemberIds)
            .eq("is_active", true);

        if (recipientsError || !recipients || recipients.length === 0) {
            return NextResponse.json(
                { error: "No valid recipients found" },
                { status: 404 }
            );
        }

        // Filter out self if somehow included
        const filteredRecipients = recipients.filter((r) => r.id !== currentTeamMember.id);

        if (filteredRecipients.length === 0) {
            return NextResponse.json(
                { error: "Cannot team up with yourself" },
                { status: 400 }
            );
        }

        // If team_up mode, create collaborator records and send notifications
        if (collaborationMode === "team_up") {
            const collaboratorsToInsert = filteredRecipients.map((recipient) => ({
                customer_id: customer.id,
                team_member_id: recipient.id,
                role: "partner",
                access_level: "full",
                invited_by: currentTeamMember.id,
                active: true,
            }));

            const { error: insertError } = await supabase
                .from("customer_collaborators")
                .upsert(collaboratorsToInsert);

            if (insertError) {
                console.error("Error creating collaborations:", insertError);
                return NextResponse.json(
                    { error: "Failed to create collaborations" },
                    { status: 500 }
                );
            }

            // Create notifications for each invited teamMember
            const notificationPromises = filteredRecipients.map((recipient) =>
                fetch(`${appUrl}/api/notifications/collaboration-invited`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        invitedTeamMemberId: recipient.id,
                        customerId: customer.id,
                        customerName: customer.business_name,
                        inviterTeamMemberId: currentTeamMember.id,
                        inviterName: senderFullName,
                    }),
                })
            );

            try {
                await Promise.all(notificationPromises);
            } catch (notificationError) {
                console.error("Error creating notifications:", notificationError);
                // Don't fail the collaboration if notifications fail, just log it
            }

            // Log collaboration initiation to contact log
            await supabase.from("contact_log").insert({
                customer_id: customer.id,
                team_member_id: currentTeamMember.id,
                type: "other",
                subject: `Teamed up with ${filteredRecipients.length} team member(s)`,
                notes: message
                    ? `${message}\n\nTeam members: ${filteredRecipients.map((r) => `${r.first_name} ${r.last_name || ""}`.trim()).join(", ")}`
                    : `Team members: ${filteredRecipients.map((r) => `${r.first_name} ${r.last_name || ""}`.trim()).join(", ")}`,
                contact_date: new Date().toISOString(),
            });
        }

        // Send emails to recipients
        const senderFullName = `${currentTeamMember.first_name} ${currentTeamMember.last_name || ""}`.trim();
        const customerUrl = `${appUrl}/dashboard/customers/${customer.customer_id || customer.id}`;

        const emailPromises = filteredRecipients.map(async (recipient) => {
            const recipientFullName = `${recipient.first_name} ${recipient.last_name || ""}`.trim();

            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${collaborationMode === "team_up" ? "Collaboration Invitation" : "Contact Shared"}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #E85D04 0%, #DC2F02 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
        ${collaborationMode === "team_up" ? "🤝 Team Up Invitation" : "📤 Contact Shared"}
      </h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      
      <!-- Greeting -->
      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #1e293b;">
        Hi <strong>${recipientFullName}</strong>,
      </p>

      <!-- Message -->
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #475569;">
        ${collaborationMode === "team_up"
                    ? `<strong>${senderFullName}</strong> has invited you to team up on an opportunity in NTS Claims Tracker:`
                    : `<strong>${senderFullName}</strong> has shared a customer contact with you in the NTS Claims Tracker:`
                }
      </p>

      <!-- Customer Card -->
      <div style="background-color: #f1f5f9; border-left: 4px solid #E85D04; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1e293b;">
          ${customer.business_name}
        </h2>
        ${customer.customer_id
                    ? `<p style="margin: 0; font-size: 14px; color: #64748b;">
          Customer ID: <strong>${customer.customer_id}</strong>
        </p>`
                    : ""
                }
      </div>

      ${collaborationMode === "team_up"
                    ? `
      <!-- Team Up Details -->
      <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af;">
          👥 Collaboration Details
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #0c4a6e;">
          You now have full access to this opportunity alongside <strong>${senderFullName}</strong>. You can:
        </p>
        <ul style="margin: 12px 0 0; padding-left: 20px; font-size: 14px; color: #0c4a6e;">
          <li>View and manage contact information</li>
          <li>Log calls, emails, and activity notes</li>
          <li>Create and track follow-up tasks</li>
          <li>Receive notifications on team activity</li>
        </ul>
      </div>
      `
                    : ""
                }

      ${message
                    ? `
      <!-- Message from Sender -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e;">
          💬 Message from ${senderFullName}:
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #78350f;">
          ${message.replace(/\n/g, "<br>")}
        </p>
      </div>
      `
                    : ""
                }

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${customerUrl}" style="display: inline-block; background: #fc7017; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(232, 93, 4, 0.2);">
          ${collaborationMode === "team_up" ? "View Opportunity" : "View Customer Details"}
        </a>
      </div>

      <!-- Footer Note -->
      <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #64748b; text-align: center;">
        ${collaborationMode === "team_up"
                    ? "You can manage your collaborations and permissions in the opportunity details."
                    : "This contact was shared on"
                } ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
      </p>

    </div>

    <!-- Email Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
        Nationwide Transport Services | Claims Tracker
      </p>
      <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
        © ${new Date().getFullYear()} NTS Heavy Haulers. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
      `;

            return sendEmail({
                to: recipient.email,
                subject:
                    collaborationMode === "team_up"
                        ? `${senderFullName} invited you to team up: ${customer.business_name}`
                        : `${senderFullName} shared a contact with you: ${customer.business_name}`,
                html: emailHtml,
            });
        });

        // Wait for all emails to send
        const results = await Promise.allSettled(emailPromises);
        const failures = results.filter((r) => r.status === "rejected");
        const successes = results.filter((r) => r.status === "fulfilled");

        if (failures.length > 0) {
            console.error("Some emails failed to send:", failures);
        }

        return NextResponse.json({
            success: true,
            mode: collaborationMode,
            sent: successes.length,
            failed: failures.length,
            recipients: filteredRecipients.map((r) => `${r.first_name} ${r.last_name || ""}`.trim()),
        });
    } catch (error: any) {
        console.error("Error in collaborate endpoint:", error);
        return NextResponse.json(
            { error: error.message || "Failed to collaborate" },
            { status: 500 }
        );
    }
}
