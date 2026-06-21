import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";

// Refresh a GoTo access token using the stored refresh token
async function refreshGoToToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamMemberId: string,
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
      .eq("user_id", teamMemberId);

    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (err) {
    console.error("GoTo token refresh error:", err);
    return null;
  }
}

// GET /api/goto/devices
// Retrieves the list of registered GoTo devices for device selection
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load team member's GoTo connection
  const { data: connection, error: connError } = await supabase
    .from("goto_connections")
    .select("access_token, refresh_token, expires_at, goto_user_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connError || !connection) {
    return NextResponse.json(
      { error: "GoTo account not connected" },
      { status: 400 }
    );
  }

  if (!connection.goto_user_email) {
    return NextResponse.json(
      { error: "GoTo email not found. Please reconnect your GoTo account." },
      { status: 400 }
    );
  }

  // Get a valid access token (refresh if expiring within 5 minutes)
  let accessToken: string;
  const expiresAt = new Date(connection.expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log('[GoTo Devices] Token expiring soon, refreshing...');
    const refreshed = await refreshGoToToken(
      supabase,
      user.id,
      connection.refresh_token
    );
    if (!refreshed) {
      return NextResponse.json(
        { error: "GoTo session expired. Please reconnect your GoTo account in Settings." },
        { status: 401 }
      );
    }
    accessToken = refreshed.access_token;
  } else {
    accessToken = decrypt(connection.access_token);
  }

  const userEmail = connection.goto_user_email;

  try {
    // Fetch user's lines and devices from Jive API
    const jifUrl = `https://api.jive.com/jif/v4/user/jiveId/${encodeURIComponent(userEmail)}`;
    const jifResponse = await fetch(jifUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!jifResponse.ok) {
      const errText = await jifResponse.text();
      console.error("[GoTo Devices API Error]", {
        status: jifResponse.status,
        body: errText,
      });

      return NextResponse.json(
        {
          error: "Failed to fetch devices",
          details: errText,
          status: jifResponse.status,
        },
        { status: 502 }
      );
    }

    const jifData = await jifResponse.json();
    const pbxes = jifData.data?.tenants?.pbxes;

    if (!pbxes || pbxes.length === 0) {
      return NextResponse.json({ success: true, devices: [] });
    }

    const extensions = pbxes[0]?.extensions;
    if (!extensions || extensions.length === 0) {
      return NextResponse.json({ success: true, devices: [] });
    }

    const extension = extensions[0];
    const devices = extension.devices || [];

    // Format devices for UI
    const formattedDevices = devices.map((device: any) => ({
      id: device.id,
      name: device.name || "Unnamed Device",
      type: device.type || "unknown",
      mobile: device.mobile || false,
      presenceEnabled: device.presenceEnabled || false,
    }));

    console.log("[GoTo Devices]", formattedDevices);

    return NextResponse.json({
      success: true,
      devices: formattedDevices,
    });
  } catch (err) {
    console.error("GoTo devices fetch error:", err);
    return NextResponse.json(
      { error: "Network error contacting GoTo" },
      { status: 502 }
    );
  }
}
