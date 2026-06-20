import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/goto/auth
// Initiates the GoTo OAuth flow by redirecting to GoTo's authorization endpoint.
// Accepts an optional ?admin=true query param (admin-only) which adds org-admin
// scopes and marks the stored connection as is_admin_token = true in the callback.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdminAuth = request.nextUrl.searchParams.get("admin") === "true";

  // Only admins may request the admin token connection
  if (isAdminAuth) {
    const { data: broker } = await supabase
      .from("brokers")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!broker?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const clientId = process.env.GOTO_CLIENT_ID;

  // Dynamically determine redirect URI based on current host (localhost vs production)
  const host = request.headers.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/goto/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "GoTo Connect is not configured on this server" },
      { status: 500 }
    );
  }

  const baseScopes = [
    "calls.v2.initiate",                    // Start a call on your phone line
    "call-events.v1.notifications.manage",  // Manage notification subscriptions for call events
    "call-events.v1.events.read",           // Retrieve call events
    "voice-admin.v1.read",                  // Access voice entities like phone numbers, devices and extensions
    "cr.v1.read",                           // Access call history for phone lines in the PBX
    "voicemail.v1.voicemails.read",         // Read your voicemails
    "users.v1.read",                        // Retrieve various GoTo Connect settings of the authenticated user
    "users.v1.lines.read",                  // Retrieve your phone line information
  ];

  // Admin Center scope — required for legacy admin API (api.getgo.com/admin/rest/v1/me)
  // which returns the NUMERIC accountKey needed by call-history and user enumeration APIs.
  // The OAuth client must have "Admin Center" enabled on developer.goto.com.
  const adminScopes: string[] = [
    "identity:",                                 // Full Admin Center scope — unlocks numeric accountKey via /admin/rest/v1/me
    "queue-caller.v1.read",                      // View reporting analytics for queue calls (per-call data with queue name, agent, GoTo AI sentiment/topics)
    "cc-analytics.v1.agent-status.read",        // View reporting analytics for agent status (pause/availability/utilization data)
    "recording.v1.read",                         // Retrieve call recordings and transcripts (required for AI call quality coaching)
  ];

  const scopes = isAdminAuth
    ? [...baseScopes, ...adminScopes].join(" ")
    : baseScopes.join(" ");

  const authUrl = new URL(
    "https://authentication.logmeininc.com/oauth/authorize"
  );
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  // Force GoTo to show the authorization screen even if previously authorized.
  // prompt=consent asks for re-consent; max_age=0 forces re-authentication of
  // the user session itself — together they prevent silent token re-issuance.
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("max_age", "0");
  // Pass broker ID + admin flag in state so the callback can identify context
  // Format: "{userId}|admin" or just "{userId}"
  authUrl.searchParams.set("state", isAdminAuth ? `${user.id}|admin` : user.id);

  return NextResponse.redirect(authUrl.toString());
}
