/**
 * API Route: Create Contact Reassignment Notifications
 * Server-side only - uses service role key safely
 * Creates in-app notification AND sends email notification
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-service";
import { generateContactReassignedEmail } from "@/lib/email-templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.ntsconnect.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newBrokerId, oldBrokerId, customerId, customerName, reassignedBy, reassignedByBrokerId } = body;

    if (!newBrokerId || !customerId || !customerName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Skip if reassigning to self (hyperfocused workspace principle)
    if (newBrokerId === reassignedByBrokerId) {
      console.log("Skipping self-reassignment notification (user knows what they did)");
      return NextResponse.json({ success: true, skipped: true });
    }

    // Create service-role client (server-side only)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch new broker information with email preferences
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .select(`
        id,
        email,
        first_name,
        last_name,
        user_preferences:user_preferences(
          email_notifications_enabled
        )
      `)
      .eq("id", newBrokerId)
      .eq("is_active", true)
      .single();

    if (brokerError || !broker) {
      console.error("Error fetching new broker:", brokerError);
      return NextResponse.json(
        { error: "Broker not found" },
        { status: 404 }
      );
    }

    // Notify ONLY the new broker (not the old broker - reduces noise)
    const { error } = await supabase.from("notifications").insert({
      broker_id: newBrokerId,
      customer_id: customerId,
      type: "contact_reassigned",
      title: "Contact Reassigned to You",
      message: `${customerName} was reassigned to you by ${reassignedBy}`,
      is_read: false,
      is_archived: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error creating reassignment notification:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Send email notification if enabled
    const prefs = Array.isArray(broker.user_preferences)
      ? broker.user_preferences[0]
      : broker.user_preferences;

    if (prefs?.email_notifications_enabled) {
      const emailTemplate = generateContactReassignedEmail(
        broker.first_name || "there",
        customerName,
        reassignedBy,
        appUrl
      );

      await sendEmail({
        to: broker.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });

      console.log(`📧 Reassignment email notification sent to ${broker.email}`);
    }

    console.log(`✅ Created reassignment notification for new broker ${newBrokerId} (${customerName})`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to create contact reassignment notification:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
