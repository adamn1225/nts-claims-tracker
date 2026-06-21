import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";

// Gets a valid GoTo access token, refreshing if needed
// Returns null if connection not found or refresh failed
async function getValidAccessToken(teamMemberId: string): Promise<string | null> {
  // Import server supabase dynamically to avoid issues
  const { createClient } = await import("@/lib/supabase/server");
  const { encrypt } = await import("@/lib/encryption");
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("goto_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", teamMemberId)
    .maybeSingle();

  if (!connection) return null;

  const expiresAt = new Date(connection.expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    const clientId = process.env.GOTO_CLIENT_ID;
    const clientSecret = process.env.GOTO_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const refreshToken = decrypt(connection.refresh_token);
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://authentication.logmeininc.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from("goto_connections")
      .update({
        access_token: encrypt(data.access_token),
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", teamMemberId);

    return data.access_token;
  }

  return decrypt(connection.access_token);
}

// POST /api/goto/setup-channel
// Creates a GoTo webhook notification channel and subscribes to call events.
// Called when a team member starts a Power Dialer session.
export async function POST(request: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("goto_connections")
    .select("account_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json(
      { error: "GoTo account not connected" },
      { status: 400 }
    );
  }

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "GoTo session expired. Please reconnect in Settings." },
      { status: 401 }
    );
  }

  // Build the webhook URL — GoTo will POST call events here
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "";
  const webhookUrl = `${appUrl}/api/goto/webhook`;

  // Unique channel nickname per session (team_member_id + timestamp)
  const channelNickname = `nts-dialer-${user.id.slice(0, 8)}-${Date.now()}`;

  // Step 1: Create webhook notification channel
  let channelId: string;
  try {
    const channelResponse = await fetch(
      `https://api.goto.com/notification-channel/v1/channels/${channelNickname}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          channelType: "Webhook",
          webhookChannelData: {
            webhook: { url: webhookUrl },
          },
        }),
      }
    );

    if (!channelResponse.ok) {
      const errText = await channelResponse.text();
      console.error("GoTo channel creation failed:", channelResponse.status, errText);
      return NextResponse.json(
        { error: "Failed to create notification channel" },
        { status: 502 }
      );
    }

    const channelData = await channelResponse.json();
    channelId = channelData.channelId;
  } catch (err) {
    console.error("GoTo channel error:", err);
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }

  // Step 2: Subscribe to call events (STARTING and ENDING) for this account
  if (connection.account_key) {
    try {
      const subscribeResponse = await fetch(
        "https://api.goto.com/call-events/v1/subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            channelId,
            accountKeys: [
              {
                id: connection.account_key,
                events: ["STARTING", "ACTIVE", "ENDING"],
              },
            ],
          }),
        }
      );

      if (!subscribeResponse.ok) {
        const errText = await subscribeResponse.text();
        console.warn("GoTo event subscription failed (non-fatal):", subscribeResponse.status, errText);
        // Non-fatal: the channel is created, manual outcome logging will still work
      }
    } catch (err) {
      console.warn("GoTo subscription error (non-fatal):", err);
    }
  }

  return NextResponse.json({ success: true, channelId, channelNickname });
}

// DELETE /api/goto/setup-channel
// Tears down the GoTo notification channel at end of session
export async function DELETE(request: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { channelId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { channelId } = body;
  if (!channelId) {
    return NextResponse.json({ success: true }); // Nothing to tear down
  }

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ success: true }); // Best-effort; token gone anyway
  }

  try {
    await fetch(
      `https://api.goto.com/notification-channel/v1/channels/${channelId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch (err) {
    console.warn("GoTo channel teardown error (non-fatal):", err);
  }

  return NextResponse.json({ success: true });
}
