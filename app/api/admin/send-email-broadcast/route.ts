import { NextResponse } from "next/server";
import { sendDailyDigestEmails } from "@/lib/notifications-server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-service";
import {
  replaceTokens,
  getTeamMemberTokens,
  getCustomerTokens,
  mergeTokens,
} from "@/lib/email-template-processor";

/**
 * POST /api/admin/send-email-broadcast
 * Admin-only endpoint to send emails on-demand
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: teamMember } = await supabase
      .from("team_members")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!teamMember?.is_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { emailType, recipient, specificEmail, templateId, officeFilter } = body;

    console.log("📧 Admin email broadcast:", {
      emailType,
      recipient,
      specificEmail,
      templateId,
      officeFilter,
    });

    let emailsSent = 0;

    if (emailType === "daily_digest") {
      // Handle different recipient types
      if (recipient === "test") {
        // Send to current admin user only
        emailsSent = await sendDailyDigestEmails(user.id);
      } else if (recipient === "specific" && specificEmail) {
        // Find teamMember by email
        const { data: targetTeamMember } = await supabase
          .from("team_members")
          .select("id")
          .eq("email", specificEmail)
          .single();

        if (!targetTeamMember) {
          return NextResponse.json(
            { error: `No user found with email: ${specificEmail}` },
            { status: 404 },
          );
        }

        emailsSent = await sendDailyDigestEmails(targetTeamMember.id);
      } else if (recipient === "all") {
        // Send to all users (respects their preferences)
        emailsSent = await sendDailyDigestEmails();
      } else {
        return NextResponse.json(
          { error: "Invalid recipient configuration" },
          { status: 400 },
        );
      }
    } else if (emailType === "custom") {
      // Handle custom template emails
      if (!templateId) {
        return NextResponse.json(
          { error: "Template ID is required for custom emails" },
          { status: 400 },
        );
      }

      // Fetch the template
      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError || !template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 },
        );
      }

      // Determine recipients
      let recipientEmails: string[] = [];
      let recipientTeamMembers: any[] = [];

      if (recipient === "test") {
        const { data: currentTeamMember } = await supabase
          .from("team_members")
          .select("*")
          .eq("id", user.id)
          .single();
        if (currentTeamMember) {
          recipientTeamMembers = [currentTeamMember];
        }
      } else if (recipient === "specific" && specificEmail) {
        const { data: targetTeamMember } = await supabase
          .from("team_members")
          .select("*")
          .eq("email", specificEmail)
          .single();

        if (!targetTeamMember) {
          return NextResponse.json(
            { error: `No user found with email: ${specificEmail}` },
            { status: 404 },
          );
        }
        recipientTeamMembers = [targetTeamMember];
      } else if (recipient === "all") {
        // Get all active team members, optionally filtered by office
        let teamMembersQuery = supabase
          .from("team_members")
          .select("*")
          .eq("is_active", true);
        
        // Apply office filter if provided (for managers)
        if (officeFilter) {
          teamMembersQuery = teamMembersQuery.eq("office_location", officeFilter);
        }
        
        const { data: allTeamMembers } = await teamMembersQuery;
        recipientTeamMembers = allTeamMembers || [];
      }

      // Send emails with token replacement
      for (const recipientTeamMember of recipientTeamMembers) {
        const teamMemberTokens = await getTeamMemberTokens(
          recipientTeamMember.id,
          supabase,
        );
        const tokens = mergeTokens(teamMemberTokens, {
          first_name: recipientTeamMember.first_name || "there",
          company: "their company", // Could fetch from customer data if needed
        });

        const processedSubject = replaceTokens(template.subject, tokens);
        
        // Compile MJML to HTML if template body is MJML
        let processedBody = template.body;
        const isMjml = template.body.trim().startsWith("<mjml");
        
        if (isMjml) {
          try {
            const mjml2html = (await import("mjml")).default;
            const result = mjml2html(template.body, {
              validationLevel: "soft",
            });
            if (result.errors.length === 0) {
              processedBody = result.html;
            } else {
              console.error("MJML compilation errors:", result.errors);
              // Fall back to the original body if compilation fails
            }
          } catch (error) {
            console.error("MJML compilation failed:", error);
            // Fall back to the original body if compilation fails
          }
        }
        // If it's already HTML, use it directly
        
        // Replace tokens in the (compiled) body
        processedBody = replaceTokens(processedBody, tokens);

        const sent = await sendEmail({
          to: recipientTeamMember.email,
          subject: processedSubject,
          html: processedBody,
        });

        if (sent) emailsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      message: `Sent ${emailsSent} email(s)`,
    });
  } catch (error: any) {
    console.error("Error in email broadcast:", error);
    return NextResponse.json(
      {
        error: "Failed to send emails",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
