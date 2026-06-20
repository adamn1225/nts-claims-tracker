import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// POST /api/goto/webhook  (NO AUTH — GoTo calls this endpoint directly)
// Receives GoTo call event notifications and stores them in power_dialer_events
// so the browser can receive them via Supabase Realtime.
export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Use service role to insert (bypasses RLS since no user session here)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase service role env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

  // GoTo call events have a `state.type` field: STARTING, ACTIVE, ENDING
  const stateType = (payload?.state as Record<string, unknown>)?.type as string | undefined;
  const metadata = payload?.metadata as Record<string, unknown> | undefined;

  // We need the broker's account key to look up which broker this belongs to
  const accountKey = metadata?.accountKey as string | undefined;

  if (!stateType || !accountKey) {
    // Not a call event we care about — acknowledge silently
    return NextResponse.json({ received: true });
  }

  // Map GoTo event types to our internal types
  let eventType: string;
  const participants = (payload?.state as Record<string, unknown>)?.participants as Array<Record<string, unknown>> | undefined;

  if (stateType === "ACTIVE") {
    eventType = "answered";
  } else if (stateType === "STARTING") {
    eventType = "ringing";
  } else if (stateType === "ENDING") {
    // Check participants for reason code — if any ended with BYE it was answered+ended
    // If all show NOANSWER/BUSY it was unanswered
    const hasConnected = participants?.some(
      (p) =>
        (p.status as Record<string, unknown>)?.value === "CONNECTED" ||
        (p.status as Record<string, unknown>)?.value === "DISCONNECTED"
    );
    eventType = hasConnected ? "ended" : "no_answer";
  } else {
    return NextResponse.json({ received: true });
  }

  // Find the broker who owns this account key
  const { data: connection } = await supabase
    .from("goto_connections")
    .select("user_id")
    .eq("account_key", accountKey)
    .maybeSingle();

  if (!connection) {
    // Unknown account key — acknowledge but don't store
    return NextResponse.json({ received: true });
  }

  // Extract a call ID from the event if available
  const callId =
    (metadata?.conversationSpaceId as string) ||
    (participants?.[0]?.legId as string) ||
    `unknown-${Date.now()}`;

  await supabase.from("power_dialer_events").insert({
    user_id: connection.user_id,
    call_id: callId,
    event_type: eventType,
    raw_payload: payload,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ received: true });
}
