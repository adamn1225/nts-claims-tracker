import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/goto/set-preferred-device
// Updates the user's preferred GoTo device for click-to-call
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { deviceId: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deviceId } = body;

  // Update preferred device in database
  const { error: updateError } = await supabase
    .from("goto_connections")
    .update({ preferred_device_id: deviceId })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Error updating preferred device:", updateError);
    return NextResponse.json(
      { error: "Failed to update preferred device" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
