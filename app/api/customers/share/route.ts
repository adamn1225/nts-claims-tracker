import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current broker details
    const { data: currentBroker, error: brokerError } = await supabase
      .from("brokers")
      .select("*")
      .eq("id", user.id)
      .single();

    if (brokerError || !currentBroker) {
      return NextResponse.json(
        { error: "Broker profile not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const { customerId, customerName, brokerIds, note } = await req.json();

    if (!customerId || !brokerIds || !Array.isArray(brokerIds) || brokerIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: customerId and brokerIds are required" },
        { status: 400 }
      );
    }

    // Verify current user has access to this customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, business_name, customer_id, broker_id")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if user is admin, manager, or owns the customer
    const canShare =
      currentBroker.is_admin ||
      currentBroker.is_manager ||
      customer.broker_id === currentBroker.id;

    if (!canShare) {
      return NextResponse.json(
        { error: "You don't have permission to share this customer" },
        { status: 403 }
      );
    }

    // Fetch recipient broker details
    const { data: recipients, error: recipientsError } = await supabase
      .from("brokers")
      .select("id, first_name, last_name, email")
      .in("id", brokerIds)
      .eq("is_active", true);

    if (recipientsError || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients found" },
        { status: 404 }
      );
    }

    // Get the app URL from environment or construct it
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sales.ntsconnect.com";
    const customerUrl = `${appUrl}/dashboard/customers/${customer.customer_id || customer.id}`;

    // Send email to each recipient
    const emailPromises = recipients.map(async (recipient) => {
      const recipientFullName = `${recipient.first_name} ${recipient.last_name || ''}`.trim();
      const senderFullName = `${currentBroker.first_name} ${currentBroker.last_name || ''}`.trim();
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Contact Shared</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #E85D04 0%, #DC2F02 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
        Contact Shared With You
      </h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      
      <!-- Greeting -->
      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #1e293b;">
        Hi <strong>${recipientFullName}</strong>,
      </p>

      <!-- Message -->
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #475569;">
        <strong>${senderFullName}</strong> has shared a customer contact with you in the NTS Claims Tracker:
      </p>

      <!-- Customer Card -->
      <div style="background-color: #f1f5f9; border-left: 4px solid #E85D04; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1e293b;">
          ${customer.business_name}
        </h2>
        ${customer.customer_id ? `
        <p style="margin: 0; font-size: 14px; color: #64748b;">
          Customer ID: <strong>${customer.customer_id}</strong>
        </p>
        ` : ''}
      </div>

      ${note ? `
      <!-- Note from Sender -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e;">
          Note from ${senderFullName}:
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #78350f;">
          ${note.replace(/\n/g, '<br>')}
        </p>
      </div>
      ` : ''}

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${customerUrl}" style="display: inline-block; background: #fc7017; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(232, 93, 4, 0.2);">
          View Customer Details
        </a>
      </div>

      <!-- Footer Note -->
      <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #64748b; text-align: center;">
        This contact was shared on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
      </p>

    </div>

    <!-- Email Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
        Nationwide Transport Services | Claims Tracker
      </p>
      <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
        © ${new Date().getFullYear()} NTS Heavy Haulers. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
      `;

      return sendEmail({
        to: recipient.email,
        subject: `${senderFullName} shared a contact with you: ${customer.business_name}`,
        html: emailHtml,
      });
    });

    // Wait for all emails to send
    const results = await Promise.allSettled(emailPromises);

    // Check for failures
    const failures = results.filter((r) => r.status === "rejected");
    const successes = results.filter((r) => r.status === "fulfilled");

    if (failures.length > 0) {
      console.error("Some emails failed to send:", failures);
    }

    // Optionally log the share action to contact_log or create a shares table
    // For now, we'll add it to contact_log as a custom type
    try {
      await supabase.from("contact_log").insert({
        customer_id: customer.id,
        broker_id: currentBroker.id,
        type: "other",
        subject: `Shared with ${recipients.length} broker(s)`,
        notes: note
          ? `${note}\n\nShared with: ${recipients.map((r) => `${r.first_name} ${r.last_name || ''}`.trim()).join(", ")}`
          : `Shared with: ${recipients.map((r) => `${r.first_name} ${r.last_name || ''}`.trim()).join(", ")}`,
        contact_date: new Date().toISOString(),
      });
    } catch (logError) {
      console.error("Error logging share action:", logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      sent: successes.length,
      failed: failures.length,
      recipients: recipients.map((r) => `${r.first_name} ${r.last_name || ''}`.trim()),
    });
  } catch (error: any) {
    console.error("Error sharing customer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to share customer" },
      { status: 500 }
    );
  }
}
