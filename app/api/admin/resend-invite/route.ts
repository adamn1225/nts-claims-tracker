import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-service";

// Admin client with service role key
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

export async function POST(request: Request) {
  try {
    const { teamMemberId, email, firstName, lastName } = await request.json();

    if (!teamMemberId || !email) {
      return NextResponse.json(
        { error: "TeamMember ID and email are required" },
        { status: 400 },
      );
    }

    // Generate a new random password
    const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

    // Update the user's password AND confirm email
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(teamMemberId, {
        password: tempPassword,
        email_confirm: true, // Ensure email is confirmed
      });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { error: `Failed to reset password: ${updateError.message}` },
        { status: 500 },
      );
    }

    // Send welcome email with new credentials
    try {
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/login`;

      console.log("📧 Resending invite email to:", email);

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #E85D04; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to NTS Claims Tracker</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">Hi ${firstName},</p>
                      
                      <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">
                        You've been invited to join the NTS Claims Tracker! This system will help you track cargo and transportation claims from intake through settlement, with documents, correspondence, and carrier holds in one place.
                      </p>
                      
                      <div style="background-color: #f2f2f2; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0;">
                        <h2 style="color: #08090d; margin: 0 0 15px; font-size: 18px;">Your Login Credentials</h2>
                        <p style="margin: 8px 0; color: #08090d;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 8px 0; color: #08090d;"><strong>Temporary Password:</strong> <code style="padding: 4px 8px; border-radius: 4px; font-family: monospace;color: #78350f;">${tempPassword}</code></p>
                      </div>
                      
                      <p style="font-size: 14px; color: #64748b; margin: 20px 0;">
                        <strong>Important:</strong> Please change your password immediately after your first login by going to Settings → Change Password.
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${loginUrl}" style="display: inline-block; background-color: #007adb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">Login to Your Account</a>
                          </td>
                        </tr>
                      </table>
                      
                      <h3 style="color: #1e293b; font-size: 18px; margin: 30px 0 15px;">Getting Started</h3>
                      <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Log claims from intake and track them through the board</li>
                        <li>Track document requests, acknowledgments, and follow-ups</li>
                        <li>Monitor carrier holds, do-not-pay flags, and settlements</li>
                        <li>Use the interactive tour (shown on first login) to learn the basics</li>
                      </ul>
                      
                      <p style="font-size: 16px; color: #1e293b; margin: 30px 0 10px;">
                        If you have any questions, click the Help button in the top navigation or reach out to your team.
                      </p>
                      
                      <p style="font-size: 16px; color: #1e293b; margin: 20px 0 0;">
                        Best regards,<br>
                        <strong>NTS Claims Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
                      <p style="color: #64748b; font-size: 13px; margin: 0;">
                        Nationwide Transport Services | Claims Team
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const emailSent = await sendEmail({
        to: email,
        subject: "NTS Claims Tracker - Your Login Credentials",
        html: emailHtml,
        text: `Welcome to NTS Claims Tracker!\n\nYour Login Credentials:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease login at ${loginUrl} and change your password immediately in Settings.\n\nBest regards,\nNTS Sales Team`,
      });

      if (!emailSent) {
        console.error(
          "❌ Failed to resend email - both SendGrid and Zoho failed",
        );
        return NextResponse.json(
          { error: "Failed to send email. Check server logs for details." },
          { status: 500 },
        );
      }

      console.log("✅ Invite email resent successfully to:", email);
    } catch (emailError) {
      console.error("❌ Failed to send email:", emailError);
      return NextResponse.json(
        { error: "Failed to send email. Check server logs for details." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invite email resent successfully",
    });
  } catch (error) {
    console.error("Resend invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
