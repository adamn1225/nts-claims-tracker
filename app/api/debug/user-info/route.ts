import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get auth user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", authError },
        { status: 401 },
      );
    }

    // Check broker record
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      authUser: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      broker: broker || null,
      brokerError: brokerError?.message || null,
      hasBrokerRecord: !!broker,
    });
  } catch (error) {
    console.error("User info error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
