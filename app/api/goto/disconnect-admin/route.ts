import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/goto/disconnect-admin
// Admin-only: removes the org-wide admin GoTo token (is_admin_token = true).
// This is separate from the regular /api/goto/disconnect which only removes
// the current user's personal token row.
export async function DELETE() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

    if (!broker?.is_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
        .from("goto_connections")
        .delete()
        .eq("is_admin_token", true);

    if (error) {
        console.error("Failed to disconnect admin GoTo token:", error);
        return NextResponse.json(
            { error: "Failed to disconnect admin GoTo token" },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true });
}
