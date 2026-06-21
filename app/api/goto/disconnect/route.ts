import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/goto/disconnect
// Removes the team member's GoTo connection
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("goto_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to disconnect GoTo:", error);
    return NextResponse.json(
      { error: "Failed to disconnect GoTo account" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// GET /api/goto/disconnect
// Returns the current GoTo connection status for the authenticated team member
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("goto_connections")
    .select("id, account_key, expires_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to check connection" }, { status: 500 });
  }

  return NextResponse.json({
    connected: !!data,
    connection: data
      ? {
          account_key: data.account_key,
          expires_at: data.expires_at,
          connected_at: data.created_at,
        }
      : null,
  });
}
