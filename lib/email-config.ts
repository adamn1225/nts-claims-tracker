/**
 * Email Configuration Helper
 * Fetches and caches email config from database
 */

import "server-only";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { decrypt } from "./encryption";

export interface EmailConfig {
  from_email: string;
  from_name: string;
  provider_priority: Array<{
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
  }>;
  sendgrid_api_key?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_secure?: boolean;
}

// Cached config to avoid DB hits on every email
let cachedConfig: EmailConfig | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get email configuration from database with fallback to env vars
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  // Return cached config if valid
  if (cachedConfig && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data, error } = await supabase
      .from("email_config")
      .select("*")
      .single();

    if (data && !error) {
      // Decrypt sensitive fields and merge with env fallbacks
      const decryptedConfig: EmailConfig = {
        from_email:
          data.from_email ||
          process.env.SENDGRID_FROM_EMAIL ||
          "noah@ntslogistics.com",
        from_name:
          data.from_name || process.env.SENDGRID_FROM_NAME || "NTS Logistics",
        provider_priority: data.provider_priority || [
          { id: "sendgrid", name: "SendGrid API", enabled: true, priority: 1 },
        ],
        // Use database credentials if set, otherwise fall back to env vars
        sendgrid_api_key: data.sendgrid_api_key
          ? decrypt(data.sendgrid_api_key)
          : process.env.SENDGRID_API_KEY,
        // Remove SMTP fallback - SendGrid only
        smtp_host: undefined,
        smtp_port: undefined,
        smtp_user: undefined,
        smtp_password: undefined,
        smtp_secure: false,
      };

      cachedConfig = decryptedConfig;
      cacheTime = Date.now();
      console.log("✅ Loaded email config (database + env fallbacks)");
      return decryptedConfig;
    }
  } catch (error) {
    console.warn(
      "Failed to load email config from database, using env fallback:",
      error,
    );
  }

  // Fallback to environment variables
  const envConfig: EmailConfig = {
    from_email: process.env.SENDGRID_FROM_EMAIL || "noah@ntslogistics.com",
    from_name: process.env.SENDGRID_FROM_NAME || "NTS Logistics",
    provider_priority: [
      { id: "sendgrid", name: "SendGrid API", enabled: true, priority: 1 },
    ],
    sendgrid_api_key: process.env.SENDGRID_API_KEY,
    // SendGrid only - no SMTP fallback
    smtp_host: undefined,
    smtp_port: undefined,
    smtp_user: undefined,
    smtp_password: undefined,
    smtp_secure: false,
  };

  console.log("⚠️  Using email config from environment variables");
  return envConfig;
}

/**
 * Clear the config cache (useful after saving new settings)
 */
export function clearEmailConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}
