import { NextRequest, NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow the Cal Task AI Chrome extension (and any future internal tools)
// to hit this endpoint. Chrome extension origins look like
// `chrome-extension://<id>` — we accept any extension origin here because the
// caller still has to present a valid Supabase JWT to do anything.
const ALLOWED_ORIGIN_PATTERNS: Array<string | RegExp> = [
  /^chrome-extension:\/\/[a-z0-9]+$/i,
  "https://sales.ntsconnect.com",
];

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((p) =>
    typeof p === "string" ? p === origin : p.test(origin)
  );
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonWithCors(
  origin: string | null,
  body: unknown,
  init?: { status?: number }
) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: corsHeaders(origin),
  });
}

// CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

// ─── Auth resolver ────────────────────────────────────────────────────────────
// Accepts either:
//   1. Cookie-based Supabase session (existing web-app flow), OR
//   2. `Authorization: Bearer <supabase_jwt>` (Chrome extension / API clients).
// Returns the authenticated user, plus a Supabase client suitable for the
// `goto_connections` table reads/writes that follow.
async function resolveAuth(
  request: NextRequest
): Promise<
  | { user: { id: string }; supabase: Awaited<ReturnType<typeof createClient>> }
  | null
> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const verifier = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data.user) return null;
    // Use the cookie-based server client for DB ops — it carries the service
    // context this route already relies on for `goto_connections` access.
    const supabase = await createClient();
    return { user: { id: data.user.id }, supabase };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { user: { id: user.id }, supabase };
}

// Refresh a GoTo access token using the stored refresh token
async function refreshGoToToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brokerId: string,
  encryptedRefreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  const clientId = process.env.GOTO_CLIENT_ID;
  const clientSecret = process.env.GOTO_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const refreshToken = decrypt(encryptedRefreshToken);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await fetch(
      "https://authentication.logmeininc.com/oauth/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
      }
    );

    if (!response.ok) {
      console.error("GoTo token refresh failed:", response.status);
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    const encryptedNewToken = encrypt(data.access_token);

    await supabase
      .from("goto_connections")
      .update({
        access_token: encryptedNewToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", brokerId);

    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (err) {
    console.error("GoTo token refresh error:", err);
    return null;
  }
}

// POST /api/goto/call
// Initiates a click-to-call via GoTo Connect — rings the broker's phone first,
// then connects to the customer when the broker answers.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  const auth = await resolveAuth(request);
  if (!auth) {
    return jsonWithCors(origin, { error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = auth;

  let body: { phoneNumber: string; taskId?: string; customerId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonWithCors(origin, { error: "Invalid request body" }, { status: 400 });
  }

  const { phoneNumber } = body;

  if (!phoneNumber) {
    return jsonWithCors(origin, { error: "phoneNumber is required" }, { status: 400 });
  }

  // Normalize phone number to plain digits (no formatting)
  // GoTo/Jive API expects: "9548264318" not "+19548264318"
  const dialString = phoneNumber.replace(/\D/g, "");

  console.log("[GoTo] Phone number normalized:", phoneNumber, "→", dialString);

  // Load broker's GoTo connection
  const { data: connection, error: connError } = await supabase
    .from("goto_connections")
    .select("access_token, refresh_token, expires_at, goto_user_email, preferred_device_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connError || !connection) {
    return jsonWithCors(
      origin,
      { error: "GoTo account not connected. Please connect your GoTo account in Settings." },
      { status: 400 }
    );
  }

  if (!connection.goto_user_email) {
    return jsonWithCors(
      origin,
      { error: "GoTo email not found. Please reconnect your GoTo account in Settings." },
      { status: 400 }
    );
  }

  // Get a valid access token (refresh if expiring within 5 minutes)
  let accessToken: string;
  const expiresAt = new Date(connection.expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    const refreshed = await refreshGoToToken(
      supabase,
      user.id,
      connection.refresh_token
    );
    if (!refreshed) {
      return jsonWithCors(
        origin,
        { error: "GoTo session expired. Please reconnect your GoTo account in Settings." },
        { status: 401 }
      );
    }
    accessToken = refreshed.access_token;
  } else {
    accessToken = decrypt(connection.access_token);
  }

  // Initiate click-to-call via GoTo/Jive calls API
  try {
    const userEmail = connection.goto_user_email;
    console.log("[GoTo] Using stored email:", userEmail);

    const jifUrl = `https://api.jive.com/jif/v4/user/jiveId/${encodeURIComponent(userEmail)}`;
    const jifResponse = await fetch(jifUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!jifResponse.ok) {
      console.error("[GoTo JIF API Error]", {
        status: jifResponse.status,
        statusText: jifResponse.statusText,
        body: await jifResponse.text(),
      });

      return jsonWithCors(
        origin,
        { error: "Unable to fetch your GoTo line configuration. Please ensure you have a line configured in GoTo Connect." },
        { status: 500 }
      );
    }

    const jifData = await jifResponse.json();
    console.log("[GoTo] JIF response structure:", {
      hasTenants: !!jifData.data?.tenants,
      hasPbxes: !!jifData.data?.tenants?.pbxes,
      pbxCount: jifData.data?.tenants?.pbxes?.length,
    });

    const pbxes = jifData.data?.tenants?.pbxes;
    if (!pbxes || pbxes.length === 0) {
      return jsonWithCors(
        origin,
        { error: "No phone system (PBX) found for your GoTo account. Please contact your GoTo administrator." },
        { status: 400 }
      );
    }

    const extensions = pbxes[0]?.extensions;
    if (!extensions || extensions.length === 0) {
      return jsonWithCors(
        origin,
        { error: "No extensions found for your GoTo account. Please contact your GoTo administrator." },
        { status: 400 }
      );
    }

    const extension = extensions[0];
    const lineId = extension.id;
    const devices = extension.devices || [];

    if (devices.length === 0) {
      return jsonWithCors(
        origin,
        { error: "No devices found on your GoTo line. Please ensure the GoTo Connect desktop app or mobile app is installed and logged in." },
        { status: 400 }
      );
    }

    let deviceId: string;
    if (connection.preferred_device_id) {
      const preferredDevice = devices.find(
        (d: any) => d.id === connection.preferred_device_id
      );
      if (preferredDevice) {
        deviceId = connection.preferred_device_id;
        console.log("[GoTo] Using preferred device:", preferredDevice.name);
      } else {
        deviceId = devices[0].id;
        console.warn("[GoTo] Preferred device not found, using first available:", devices[0].name);
      }
    } else {
      deviceId = devices[0].id;
      console.log("[GoTo] No device preference, using first available:", devices[0].name);
    }

    console.log("[GoTo] Using lineId:", lineId, "deviceId:", deviceId);

    const callPayload = {
      dialString: dialString,
      autoAnswer: false,
      from: { lineId, deviceId },
    };

    console.log("[GoTo] Initiating call with payload:", callPayload);

    const callResponse = await fetch("https://api.jive.com/calls/v2/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(callPayload),
    });

    if (!callResponse.ok) {
      const errText = await callResponse.text();
      console.error("[GoTo Call API Error]", {
        status: callResponse.status,
        statusText: callResponse.statusText,
        body: errText,
        headers: Object.fromEntries(callResponse.headers.entries()),
      });

      if (callResponse.status === 401) {
        return jsonWithCors(
          origin,
          { error: "GoTo session expired. Please reconnect your GoTo account in Settings." },
          { status: 401 }
        );
      }

      let errorMessage = "Failed to initiate call. ";
      let errorDetails = "";
      try {
        const errJson = JSON.parse(errText);
        console.error("[GoTo Error JSON]", errJson);

        if (errJson.error_description) {
          errorDetails = errJson.error_description;
        } else if (errJson.message) {
          errorDetails = errJson.message;
        } else if (errJson.error) {
          errorDetails = errJson.error;
        }

        if (errorDetails) {
          errorMessage += errorDetails;
        }
      } catch {
        console.error("[GoTo Error - Not JSON]", errText);
      }

      if (
        callResponse.status === 404 ||
        errText.toLowerCase().includes("no active device") ||
        errText.toLowerCase().includes("device not found")
      ) {
        errorMessage =
          "No active GoTo device found. Please launch the GoTo Connect desktop app or ensure your desk phone is online and registered.";
      } else if (callResponse.status === 403) {
        errorMessage = "GoTo permissions error. Verify your account has calling permissions enabled.";
      } else if (
        callResponse.status === 400 &&
        (errText.toLowerCase().includes("malformed") ||
          errText.toLowerCase().includes("invalid"))
      ) {
        errorMessage =
          "Request validation error. " +
          (errorDetails ||
            "Please ensure you have a registered GoTo device (desktop app, desk phone, or mobile app) and it's online.");
      } else if (!errorDetails && !errorMessage.includes("GoTo")) {
        errorMessage += " Ensure the GoTo Connect app is running and you're signed in.";
      }

      return jsonWithCors(origin, { error: errorMessage }, { status: 502 });
    }

    const callData = await callResponse.json();
    console.log("[GoTo] Call queued successfully:", callData);

    return jsonWithCors(origin, {
      success: true,
      initiatorId: callData.initiatorId || null,
      status: "QUEUED",
    });
  } catch (err) {
    console.error("GoTo call initiation error:", err);
    return jsonWithCors(
      origin,
      { error: "Network error contacting GoTo. Please try again." },
      { status: 502 }
    );
  }
}
