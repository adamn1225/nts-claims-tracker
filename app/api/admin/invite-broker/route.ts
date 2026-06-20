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
    const { email, firstName, lastName, office, isRemote, isAdmin, isManager } =
      await request.json();

    // Validate input
    if (!email || !firstName) {
      return NextResponse.json(
        { error: "Email and first name are required" },
        { status: 400 },
      );
    }

    // Validate email domain (only NTS/Heavy Haulers domains allowed)
    if (
      !email.endsWith("@ntslogistics.com") &&
      !email.endsWith("@nationwidetransportservices.com")
    ) {
      return NextResponse.json(
        {
          error:
            "Only NTS Logistics or Nationwide Transport Services email addresses are allowed",
        },
        { status: 400 },
      );
    }

    // Generate a random password (user can reset it on first login)
    const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

    // Check if user already exists (from failed previous attempt)
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some((u) => u.email === email);

    let userId: string;

    if (userExists) {
      console.log(`User ${email} already exists, updating password...`);
      const existingUserId = existingUser!.users!.find(
        (u) => u.email === email,
      )!.id;

      // Update existing user's password
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
          password: tempPassword,
          user_metadata: {
            first_name: firstName,
            last_name: lastName || "",
          },
        });

      if (updateError) {
        console.error("Error updating existing user:", updateError);
        return NextResponse.json(
          { error: `Failed to update user: ${updateError.message}` },
          { status: 500 },
        );
      }

      userId = existingUserId;
    } else {
      // Create user in Supabase Auth
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true, // Skip email confirmation since you have it disabled
          user_metadata: {
            first_name: firstName,
            last_name: lastName || "",
          },
        });

      if (authError) {
        console.error("Auth error:", authError);
        return NextResponse.json(
          { error: `Failed to create user: ${authError.message}` },
          { status: 500 },
        );
      }

      userId = authData.user.id;
    }

    // Insert or update broker record (triggers will handle user_preferences and broker_permissions)
    const { error: brokerError } = await supabaseAdmin
      .from("brokers")
      .upsert(
        {
          id: userId,
          email,
          first_name: firstName,
          last_name: lastName || null,
          office_location: office || null,
          is_remote: isRemote,
          is_admin: isAdmin || false,
          is_manager: isManager || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (brokerError) {
      console.error("Broker insert error:", brokerError);
      return NextResponse.json(
        { error: `Failed to create broker record: ${brokerError.message}` },
        { status: 500 },
      );
    }

    // Create welcome notification
    const { error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        broker_id: userId,
        title: "Welcome to NTS Claims Tracker! 🎉",
        message: `Hi ${firstName}! Your account has been created successfully. We're excited to have you on board. Check out the Help section to get started with managing your book of business and tracking customer follow-ups.`,
        type: "system",
        priority: "normal",
        is_read: false,
        is_archived: false,
        link_url: "/dashboard/help",
        created_at: new Date().toISOString(),
      });

    if (notificationError) {
      console.error(
        "Failed to create welcome notification:",
        notificationError,
      );
      // Don't fail the whole request if notification fails
    }

    // Send welcome email with credentials
    try {
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/login`;

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
                        You've been invited to join the NTS Claims Tracker CRM! This system will help you manage your book of business, track customer follow-ups, and never miss an opportunity.
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
                        <li>Add your customers and prospects to build your book of business</li>
                        <li>Create tasks and set reminders for follow-ups</li>
                        <li>Track customer status through the pipeline</li>
                        <li>Use the interactive tour (shown on first login) to learn the basics</li>
                      </ul>
                      
                      <p style="font-size: 16px; color: #1e293b; margin: 30px 0 10px;">
                        If you have any questions, click the Help button in the top navigation or reach out to your team.
                      </p>
                      
                      <p style="font-size: 16px; color: #1e293b; margin: 20px 0 0;">
                        Best regards,<br>
                        <strong>NTS Sales Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
                      <p style="color: #64748b; font-size: 13px; margin: 0;">
                        Nationwide Transport Services | Freight Broker CRM
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
        subject: "Welcome to NTS Claims Tracker - Your Account is Ready",
        html: emailHtml,
        text: `Welcome to NTS Claims Tracker!\n\nYou've been invited to join the NTS Claims Tracker CRM.\n\nYour Login Credentials:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease login at ${loginUrl} and change your password immediately in Settings.\n\nBest regards,\nNTS Sales Team`,
      });

      if (!emailSent) {
        console.error(
          "❌ Failed to send welcome email - both SendGrid and Zoho failed",
        );
        return NextResponse.json({
          success: true,
          warning:
            "Broker created but welcome email failed to send. Use 'Resend Invite' to try again.",
          emailError: "Email delivery failed",
        });
      }

      console.log("✅ Welcome email sent successfully to:", email);
    } catch (emailError) {
      console.error("❌ Failed to send welcome email:", emailError);
      return NextResponse.json({
        success: true,
        warning:
          "Broker created but welcome email failed to send. Use 'Resend Invite' to try again.",
        emailError:
          emailError instanceof Error
            ? emailError.message
            : "Unknown email error",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Broker invited successfully. Welcome email sent.",
    });
  } catch (error) {
    console.error("Invite broker error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
