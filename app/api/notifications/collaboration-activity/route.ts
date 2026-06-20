import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Create a "collaboration activity" notification
 * Called when a team member logs activity (call/email/note) on a shared customer
 * Batched to avoid notification spam
 * 
 * Body: {
 *   collaboratorBrokerIds: string[] (recipients - team members),
 *   customerId: string,
 *   customerName: string,
 *   activityType: "call" | "email" | "note",
 *   activityMessage: string,
 *   activityByBrokerId: string,
 *   activityByBrokerName: string,
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
            collaboratorBrokerIds,
            customerId,
            customerName,
            activityType,
            activityMessage,
            activityByBrokerId,
            activityByBrokerName,
        } = await req.json();

        if (
            !collaboratorBrokerIds ||
            !customerId ||
            !activityType ||
            !activityByBrokerId ||
            !activityByBrokerName
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (
            !Array.isArray(collaboratorBrokerIds) ||
            collaboratorBrokerIds.length === 0
        ) {
            return NextResponse.json(
                { error: "collaboratorBrokerIds must be a non-empty array" },
                { status: 400 }
            );
        }

        // Filter out self-notifications
        const recipients = collaboratorBrokerIds.filter(
            (id) => id !== activityByBrokerId
        );

        if (recipients.length === 0) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: "No recipients after filtering self",
            });
        }

        // Format activity message based on type
        const typeEmoji: Record<string, string> = {
            call: "📞",
            email: "📧",
            note: "📝",
        };

        const typeLabel: Record<string, string> = {
            call: "Logged a call",
            email: "Sent an email",
            note: "Added a note",
        };

        const message = `${activityByBrokerName} ${typeLabel[activityType] || "updated"} on ${customerName}${activityMessage ? `: "${activityMessage}"` : ""
            }`;

        // Create notifications for each recipient
        const notificationsToInsert = recipients.map((brokerId) => ({
            broker_id: brokerId,
            customer_id: customerId,
            type: "collaboration_activity",
            title: `${typeEmoji[activityType]} Activity on shared opportunity`,
            message,
            link_url: `/dashboard/customers/${customerId}`,
        }));

        const { data, error } = await supabase
            .from("notifications")
            .insert(notificationsToInsert)
            .select();

        if (error) {
            console.error("Error creating collaboration activity notifications:", error);
            return NextResponse.json(
                { error: "Failed to create notifications" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            notificationsCreated: data?.length || 0,
        });
    } catch (error: any) {
        console.error("Error in collaboration-activity endpoint:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
