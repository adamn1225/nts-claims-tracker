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
 * POST /api/admin/update-user-email
 * 
 * Change a user's email address (admin only)
 * Updates both Supabase Auth and teamMember record
 * 
 * Body: { 
 *   oldEmail: string, 
 *   newEmail: string 
 * }
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
        const { data: teamMember } = await supabase
            .from("team_members")
            .select("is_admin")
            .eq("id", session.user.id)
            .single();

        if (!teamMember?.is_admin) {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 }
            );
        }

        const { oldEmail, newEmail } = await request.json();

        if (!oldEmail || !newEmail) {
            return NextResponse.json(
                { error: "Both oldEmail and newEmail are required" },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return NextResponse.json(
                { error: "Invalid email format" },
                { status: 400 }
            );
        }

        console.log(`📧 Updating email: ${oldEmail} → ${newEmail}`);

        // Find user by old email using admin client
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            console.error("Error listing users:", listError);
            return NextResponse.json(
                { error: "Failed to find user" },
                { status: 500 }
            );
        }

        const user = users.users.find(u => u.email?.toLowerCase() === oldEmail.toLowerCase());

        if (!user) {
            return NextResponse.json(
                { error: `User not found with email: ${oldEmail}` },
                { status: 404 }
            );
        }

        // Check if new email is already in use
        const emailExists = users.users.find(u => u.email?.toLowerCase() === newEmail.toLowerCase());
        if (emailExists && emailExists.id !== user.id) {
            return NextResponse.json(
                { error: `Email ${newEmail} is already in use by another user` },
                { status: 409 }
            );
        }

        // Update user's email in Supabase Auth
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
                email: newEmail,
                email_confirm: true, // Confirm the new email immediately
            }
        );

        if (updateError) {
            console.error("Error updating user email:", updateError);
            return NextResponse.json(
                { error: `Failed to update email: ${updateError.message}` },
                { status: 500 }
            );
        }

        // Update email in team_members table (using admin client to bypass RLS)
        const { error: teamMemberUpdateError } = await supabaseAdmin
            .from("team_members")
            .update({ email: newEmail })
            .eq("id", user.id);

        if (teamMemberUpdateError) {
            console.error("Error updating team member email:", teamMemberUpdateError);
            // Auth email is updated, but teamMember table failed
            return NextResponse.json(
                {
                    success: true,
                    warning: "Email updated in Auth but failed to update team_members table",
                    message: `Email changed from ${oldEmail} to ${newEmail}`,
                    user: {
                        id: updatedUser.user.id,
                        email: updatedUser.user.email,
                        email_confirmed_at: updatedUser.user.email_confirmed_at,
                    },
                },
                { status: 200 }
            );
        }

        console.log(`✅ Email updated successfully: ${oldEmail} → ${newEmail}`);

        return NextResponse.json({
            success: true,
            message: `Email changed from ${oldEmail} to ${newEmail}`,
            user: {
                id: updatedUser.user.id,
                email: updatedUser.user.email,
                email_confirmed_at: updatedUser.user.email_confirmed_at,
            },
        });

    } catch (error) {
        console.error("❌ Update email error:", error);
        return NextResponse.json(
            {
                error: "Failed to update user email",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
