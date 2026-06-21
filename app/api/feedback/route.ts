import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { 
      category, 
      rating, 
      message, 
      pageContext,
      attachmentPath,
      attachmentName,
      attachmentSize,
      attachmentType,
    } = body;

    // Validation
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Feedback message is required" },
        { status: 400 },
      );
    }

    if (rating && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    // Get team member info
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("email, first_name, last_name")
      .eq("id", user.id)
      .single();

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        team_member_id: user.id,
        broker_email: teamMember?.email || user.email,
        team_member_name: teamMember
          ? `${teamMember.first_name} ${teamMember.last_name || ""}`.trim()
          : "Unknown",
        category: category || "general",
        rating: rating || null,
        message: message.trim(),
        page_context: pageContext || null,
        user_agent: request.headers.get("user-agent") || null,
        attachment_path: attachmentPath || null,
        attachment_name: attachmentName || null,
        attachment_size: attachmentSize || null,
        attachment_type: attachmentType || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting feedback:", insertError);
      return NextResponse.json(
        { error: "Failed to submit feedback" },
        { status: 500 },
      );
    }

    // Send email notification using SendGrid
    // Note: You'll need to set SENDGRID_API_KEY in your environment variables
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const feedbackRecipient =
      process.env.FEEDBACK_EMAIL || "feedback@ntstransport.com";
    const fromEmail =
      process.env.SENDGRID_FROM_EMAIL || "noreply@ntstransport.com";
    const fromName = process.env.SENDGRID_FROM_NAME || "NTS Claims Tracker";

    if (sendGridApiKey) {
      try {
        const emailResponse = await fetch(
          "https://api.sendgrid.com/v3/mail/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sendGridApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [
                {
                  to: [{ email: feedbackRecipient }],
                  subject: `NTS Claims Tracker Feedback: ${category || "General"}`,
                },
              ],
              from: {
                email: fromEmail,
                name: fromName,
              },
              content: [
                {
                  type: "text/html",
                  value: `
                    <h2>New Feedback Received</h2>
                    <p><strong>From:</strong> ${teamMember ? `${teamMember.first_name} ${teamMember.last_name || ""}`.trim() : "Unknown"} (${teamMember?.email || user.email})</p>
                    <p><strong>Category:</strong> ${category || "General"}</p>
                    ${rating ? `<p><strong>Rating:</strong> ${"⭐".repeat(rating)} (${rating}/5)</p>` : ""}
                    ${pageContext ? `<p><strong>Page:</strong> ${pageContext}</p>` : ""}
                    ${attachmentName ? `<p><strong>Attachment:</strong> ${attachmentName} (${(attachmentSize / 1024).toFixed(1)} KB)</p>` : ""}
                    <p><strong>Message:</strong></p>
                    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #E85D04; margin: 10px 0;">
                      ${message.replace(/\n/g, "<br>")}
                    </div>
                    <p style="color: #666; font-size: 12px;">Submitted: ${new Date().toLocaleString()}</p>
                    <p style="color: #666; font-size: 12px;">User Agent: ${request.headers.get("user-agent") || "Unknown"}</p>
                  `,
                },
              ],
            }),
          },
        );

        if (!emailResponse.ok) {
          console.error("SendGrid error:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Error sending feedback email:", emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn("SENDGRID_API_KEY not configured - feedback email not sent");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Feedback submitted successfully",
        feedbackId: feedback.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
