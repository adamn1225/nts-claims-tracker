import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Initialize Supabase server client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Encryption key from environment (should be a 32-byte hex string)
const ENCRYPTION_KEY =
  process.env.SENDGRID_ENCRYPTION_KEY || "default-key-change-in-production";

/**
 * Encrypt a string using AES-256-GCM
 */
function encryptSendGridKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32), "utf-8");

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(apiKey, "utf-8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted as base64 for storage
  const combined = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  return Buffer.from(combined).toString("base64");
}

/**
 * Decrypt a SendGrid API key
 */
export function decryptSendGridKey(encryptedKey: string): string | null {
  try {
    const combined = Buffer.from(encryptedKey, "base64").toString("utf-8");
    const [ivHex, authTagHex, encrypted] = combined.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = Buffer.from(
      ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32),
      "utf-8",
    );

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf-8");
    decrypted += decipher.final("utf-8");

    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt SendGrid key:", error);
    return null;
  }
}

interface NotificationPreferences {
  inAppNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  digestTime?: string; // Optional: admin can set custom digest time
  timezone?: string; // IANA timezone (e.g. America/New_York) for this broker
}

/**
 * GET /api/user-preferences
 * Retrieve user notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    // Get the user from Supabase session via Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get preferences from database
    const { data, error } = await supabase
      .from("user_preferences")
      .select("in_app_notifications_enabled, email_notifications_enabled, digest_time, timezone")
      .eq("broker_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching preferences:", error);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      inAppNotificationsEnabled: data?.in_app_notifications_enabled ?? true,
      emailNotificationsEnabled: data?.email_notifications_enabled ?? true,
      digestTime: data?.digest_time ?? "08:00",
      timezone: data?.timezone ?? "America/New_York",
    });
  } catch (error) {
    console.error("Error in GET /api/user-preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/user-preferences
 * Save user notification preferences
 */
export async function POST(request: NextRequest) {
  try {
    // Get the user from Supabase session via Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: NotificationPreferences = await request.json();

    // Prepare update data
    const updateData: Record<string, any> = {
      in_app_notifications_enabled: body.inAppNotificationsEnabled,
      email_notifications_enabled: body.emailNotificationsEnabled,
    };

    // Include digest_time if provided (admin setting)
    if (body.digestTime) {
      updateData.digest_time = body.digestTime;
    }

    // Include timezone if provided (per-broker setting)
    if (body.timezone) {
      updateData.timezone = body.timezone;
    }

    // Upsert preferences (insert if doesn't exist, update if does)
    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          broker_id: user.id,
          ...updateData,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "broker_id",
        },
      )
      .select();

    if (error) {
      console.error("Error saving preferences:", error);
      return NextResponse.json(
        { error: "Failed to save preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.[0],
    });
  } catch (error) {
    console.error("Error in POST /api/user-preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
