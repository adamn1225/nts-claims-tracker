import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Admin client with service role key
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

/**
 * POST /api/admin/confirm-user-email
 * 
 * Manually confirm a user's email address (admin only)
 * Use this when a user is stuck in "email not confirmed" state
 * 
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerClient();

        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin
        const { data: broker } = await supabase
            .from("brokers")
            .select("is_admin")
            .eq("id", session.user.id)
            .single();

        if (!broker?.is_admin) {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 }
            );
        }

        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // Get user by email using admin API
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            console.error("Error listing users:", listError);
            return NextResponse.json(
                { error: "Failed to find user" },
                { status: 500 }
            );
        }

        const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Update user to confirm email
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
                email_confirm: true,
                ban_duration: "none", // Unban if banned
            }
        );

        if (updateError) {
            console.error("Error confirming user:", updateError);
            return NextResponse.json(
                { error: `Failed to confirm user: ${updateError.message}` },
                { status: 500 }
            );
        }

        console.log(`✅ Email confirmed for user: ${email}`);

        return NextResponse.json({
            success: true,
            message: `Email confirmed for ${email}`,
            user: {
                id: updatedUser.user.id,
                email: updatedUser.user.email,
                email_confirmed_at: updatedUser.user.email_confirmed_at,
            },
        });

    } catch (error) {
        console.error("❌ Confirm user error:", error);
        return NextResponse.json(
            {
                error: "Failed to confirm user email",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
