import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt, maskValue } from "@/lib/encryption";

/**
 * GET /api/admin/email-config
 * Get current email configuration (decrypts sensitive fields)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Get email config
    const { data: config, error: configError } = await supabase
      .from("email_config")
      .select("*")
      .single();

    if (configError) {
      // If no config exists, return defaults from env
      return NextResponse.json({
        success: true,
        config: {
          from_email: process.env.SENDGRID_FROM_EMAIL || "",
          from_name: process.env.SENDGRID_FROM_NAME || "NTS Claims Tracker",
          cc_emails: [],
          bcc_emails: [],
          provider_priority: [
            {
              id: "sendgrid",
              name: "SendGrid API",
              enabled: true,
              priority: 1,
            },
            { id: "smtp", name: "SMTP (Zoho)", enabled: true, priority: 2 },
            { id: "mailjet", name: "Mailjet", enabled: false, priority: 3 },
          ],
          sendgrid_api_key: process.env.SENDGRID_API_KEY
            ? maskValue(process.env.SENDGRID_API_KEY, 10)
            : "",
          smtp_host: process.env.AUTH_SMTP_HOST || "",
          smtp_port: parseInt(process.env.AUTH_SMTP_PORT || "587"),
          smtp_user: process.env.AUTH_SMTP_USER || "",
          smtp_password: process.env.AUTH_SMTP_PASSWORD ? "••••••••" : "",
          smtp_secure: false,
          mailjet_api_key: "",
          mailjet_secret_key: "",
        },
        isDefault: true,
      });
    }

    // Decrypt sensitive fields
    let decryptedConfig: any = { ...config };

    try {
      if (config.sendgrid_api_key) {
        decryptedConfig.sendgrid_api_key = maskValue(
          decrypt(config.sendgrid_api_key),
          10,
        );
      }
      if (config.smtp_password) {
        decryptedConfig.smtp_password = "••••••••"; // Always mask password
      }
      if (config.mailjet_api_key) {
        decryptedConfig.mailjet_api_key = maskValue(
          decrypt(config.mailjet_api_key),
          8,
        );
      }
      if (config.mailjet_secret_key) {
        decryptedConfig.mailjet_secret_key = "••••••••";
      }
    } catch (decryptError) {
      console.error("Decryption error:", decryptError);
      // Return masked values if decryption fails
      decryptedConfig.sendgrid_api_key = config.sendgrid_api_key
        ? "••••••••"
        : "";
      decryptedConfig.smtp_password = config.smtp_password ? "••••••••" : "";
      decryptedConfig.mailjet_api_key = config.mailjet_api_key
        ? "••••••••"
        : "";
      decryptedConfig.mailjet_secret_key = config.mailjet_secret_key
        ? "••••••••"
        : "";
    }

    return NextResponse.json({
      success: true,
      config: decryptedConfig,
      isDefault: false,
    });
  } catch (error) {
    console.error("Get email config error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/email-config
 * Save email configuration (encrypts sensitive fields)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Get request body
    const body = await request.json();
    const {
      from_email,
      from_name,
      cc_emails,
      bcc_emails,
      provider_priority,
      sendgrid_api_key,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      smtp_secure,
      mailjet_api_key,
      mailjet_secret_key,
    } = body;

    // Validate required fields
    if (!from_email || !from_name) {
      return NextResponse.json(
        { error: "from_email and from_name are required" },
        { status: 400 },
      );
    }

    // Prepare config data
    const configData: any = {
      from_email,
      from_name,
      cc_emails: cc_emails || [],
      bcc_emails: bcc_emails || [],
      provider_priority: provider_priority || [],
      smtp_host: smtp_host || null,
      smtp_port: smtp_port ? parseInt(smtp_port.toString()) : null,
      smtp_user: smtp_user || null,
      smtp_secure: smtp_secure || false,
    };

    // Encrypt sensitive fields (only if changed - not if masked)
    try {
      if (sendgrid_api_key && !sendgrid_api_key.includes("•")) {
        configData.sendgrid_api_key = encrypt(sendgrid_api_key);
      }
      if (smtp_password && smtp_password !== "••••••••") {
        configData.smtp_password = encrypt(smtp_password);
      }
      if (mailjet_api_key && !mailjet_api_key.includes("•")) {
        configData.mailjet_api_key = encrypt(mailjet_api_key);
      }
      if (mailjet_secret_key && mailjet_secret_key !== "••••••••") {
        configData.mailjet_secret_key = encrypt(mailjet_secret_key);
      }
    } catch (encryptError) {
      console.error("Encryption error:", encryptError);
      return NextResponse.json(
        { error: "Failed to encrypt credentials" },
        { status: 500 },
      );
    }

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from("email_config")
      .select("id")
      .single();

    let result;

    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from("email_config")
        .update(configData)
        .eq("id", existingConfig.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new config
      const { data, error } = await supabase
        .from("email_config")
        .insert([configData])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      message: "Email configuration saved successfully",
      config: {
        ...result,
        // Mask sensitive fields in response
        sendgrid_api_key: result.sendgrid_api_key ? "••••••••" : null,
        smtp_password: result.smtp_password ? "••••••••" : null,
        mailjet_api_key: result.mailjet_api_key ? "••••••••" : null,
        mailjet_secret_key: result.mailjet_secret_key ? "••••••••" : null,
      },
    });
  } catch (error: any) {
    console.error("Save email config error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
