/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 * 
 * This file attempted to use service role keys on the client side - MAJOR SECURITY ISSUE!
 * Service role keys grant full database access and must NEVER be exposed to browsers.
 * 
 * USE THESE INSTEAD:
 * - POST /api/notifications/contact-assigned
 * - POST /api/notifications/contact-reassigned
 * 
 * These API routes run server-side where service role keys are safe.
 * 
 * Contact Assignment & Update Notifications
 * Creates in-app notifications when contacts are assigned, reassigned, or updated
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get service-role Supabase client (bypasses RLS)
 */
function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type ContactNotificationType =
  | "contact_assigned"
  | "contact_reassigned"
  | "contact_updated"
  | "contact_status_change";

export interface CreateContactNotificationParams {
  brokerId: string; // Who receives the notification
  customerId: string; // Which customer
  customerName: string; // Customer business name
  type: ContactNotificationType;
  title: string;
  message: string;
  actionBy?: string; // Who performed the action (admin name, broker name)
  actionByBrokerId?: string; // ID of broker who performed action
}

/**
 * Create a contact-related notification
 */
export async function createContactNotification({
  brokerId,
  customerId,
  customerName,
  type,
  title,
  message,
  actionBy,
  actionByBrokerId,
}: CreateContactNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase();

    // Create notification record
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        broker_id: brokerId,
        customer_id: customerId,
        type,
        title,
        message,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
      });

    if (notificationError) {
      console.error("Error creating contact notification:", notificationError);
      return { success: false, error: notificationError.message };
    }

    console.log(
      `✅ Created ${type} notification for broker ${brokerId} (${customerName})`,
    );

    // TODO: Optionally send email notification based on user preferences
    // await sendContactNotificationEmail(brokerId, type, customerName, message);

    return { success: true };
  } catch (error: any) {
    console.error("Failed to create contact notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create notification when contacts are assigned to a broker
 */
export async function notifyContactAssigned({
  brokerId,
  customerIds,
  customerNames,
  assignedBy,
  assignedByBrokerId,
}: {
  brokerId: string;
  customerIds: string[];
  customerNames: string[];
  assignedBy: string;
  assignedByBrokerId?: string;
}): Promise<void> {
  const count = customerIds.length;

  if (count === 0) return;

  try {
    // Create one notification if multiple contacts assigned
    if (count === 1) {
      await createContactNotification({
        brokerId,
        customerId: customerIds[0],
        customerName: customerNames[0],
        type: "contact_assigned",
        title: "New Contact Assigned",
        message: `${customerNames[0]} was assigned to you by ${assignedBy}`,
        actionBy: assignedBy,
        actionByBrokerId: assignedByBrokerId,
      });
    } else {
      // For batch assignments, create one summary notification for the first contact
      // and reference the total count in the message
      await createContactNotification({
        brokerId,
        customerId: customerIds[0],
        customerName: customerNames[0],
        type: "contact_assigned",
        title: `${count} New Contacts Assigned`,
        message: `${count} contacts were assigned to you by ${assignedBy}`,
        actionBy: assignedBy,
        actionByBrokerId: assignedByBrokerId,
      });
    }
  } catch (error) {
    console.error("Failed to notify contact assigned:", error);
  }
}

/**
 * Create notification when a contact is reassigned from one broker to another
 */
export async function notifyContactReassigned({
  newBrokerId,
  oldBrokerId,
  customerId,
  customerName,
  reassignedBy,
  reassignedByBrokerId,
}: {
  newBrokerId: string | null; // null if unassigned
  oldBrokerId: string | null; // null if previously unassigned
  customerId: string;
  customerName: string;
  reassignedBy: string;
  reassignedByBrokerId?: string;
}): Promise<void> {
  try {
    // Notify new broker (if being assigned)
    if (newBrokerId) {
      await createContactNotification({
        brokerId: newBrokerId,
        customerId,
        customerName,
        type: "contact_reassigned",
        title: "Contact Reassigned to You",
        message: `${customerName} was reassigned to you by ${reassignedBy}`,
        actionBy: reassignedBy,
        actionByBrokerId: reassignedByBrokerId,
      });
    }

    // Optionally notify old broker (if being removed/reassigned away)
    // Commenting this out for now to avoid notification spam
    // if (oldBrokerId) {
    //   await createContactNotification({
    //     brokerId: oldBrokerId,
    //     customerId,
    //     customerName,
    //     type: "contact_reassigned",
    //     title: "Contact Reassigned",
    //     message: `${customerName} was reassigned to another broker by ${reassignedBy}`,
    //     actionBy: reassignedBy,
    //     actionByBrokerId: reassignedByBrokerId,
    //   });
    // }
  } catch (error) {
    console.error("Failed to notify contact reassigned:", error);
  }
}

/**
 * Create notification when a contact's key information is updated
 */
export async function notifyContactUpdated({
  brokerId,
  customerId,
  customerName,
  updatedBy,
  updatedByBrokerId,
  changedFields,
}: {
  brokerId: string;
  customerId: string;
  customerName: string;
  updatedBy: string;
  updatedByBrokerId?: string;
  changedFields?: string[]; // Optional: list of changed field names
}): Promise<void> {
  try {
    const fieldsText = changedFields && changedFields.length > 0
      ? ` (${changedFields.join(", ")})`
      : "";

    await createContactNotification({
      brokerId,
      customerId,
      customerName,
      type: "contact_updated",
      title: "Contact Updated",
      message: `${customerName} was updated by ${updatedBy}${fieldsText}`,
      actionBy: updatedBy,
      actionByBrokerId: updatedByBrokerId,
    });
  } catch (error) {
    console.error("Failed to notify contact updated:", error);
  }
}

/**
 * Create notification when a contact's status changes
 */
export async function notifyContactStatusChange({
  brokerId,
  customerId,
  customerName,
  oldStatus,
  newStatus,
  changedBy,
  changedByBrokerId,
}: {
  brokerId: string;
  customerId: string;
  customerName: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedByBrokerId?: string;
}): Promise<void> {
  try {
    await createContactNotification({
      brokerId,
      customerId,
      customerName,
      type: "contact_status_change",
      title: "Contact Status Changed",
      message: `${customerName} status changed from ${oldStatus} to ${newStatus} by ${changedBy}`,
      actionBy: changedBy,
      actionByBrokerId: changedByBrokerId,
    });
  } catch (error) {
    console.error("Failed to notify contact status change:", error);
  }
}
