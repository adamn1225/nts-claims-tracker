import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Create a "collaboration invited" notification
 * Called when a broker is invited to team up on a customer
 * 
 * Body: {
 *   invitedBrokerId: string (recipient),
 *   customerId: string,
 *   customerName: string,
 *   inviterBrokerId: string,
 *   inviterName: string,
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication (service role or admin)
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse request
        const {
            invitedBrokerId,
            customerId,
            customerName,
            inviterBrokerId,
            inviterName,
        } = await req.json();

        if (!invitedBrokerId || !customerId || !inviterBrokerId || !inviterName) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Skip self-notification: don't notify inviter about their own invitation
        if (invitedBrokerId === inviterBrokerId) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: "Self-notification prevented",
            });
        }

        // Create notification
        const { data, error } = await supabase
            .from("notifications")
            .insert({
                broker_id: invitedBrokerId,
                customer_id: customerId,
                type: "collaboration_invited",
                title: `${inviterName} invited you to team up`,
                message: `${inviterName} invited you to collaborate on ${customerName}. You'll now have full access to view, manage activity, and track follow-ups together.`,
                link_url: `/dashboard/customers/${customerId}`,
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating collaboration notification:", error);
            return NextResponse.json(
                { error: "Failed to create notification" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            notification: data,
        });
    } catch (error: any) {
        console.error("Error in collaboration-invited endpoint:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
