/**
 * Manager Console Page - NTS Claims Tracker
 *
 * PERMISSIONS: Accessible to managers (is_manager = true) who are not admins
 * PURPOSE: Manage team members within their office location
 *
 * FEATURES:
 * - View brokers in their office
 * - Invite new brokers (restricted to their office unless can_invite_any_office)
 * - View office performance metrics
 * - CANNOT deactivate accounts (admin-only)
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ManagerConsole from "@/components/admin/ManagerConsole";

export const metadata: Metadata = {
  title: "Manager Console - NTS Claims Tracker",
  description: "Manage your team and track office performance",
};

export default async function ManagerConsolePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check if user is a manager
  const { data: broker, error } = await supabase
    .from("brokers")
    .select("is_manager, is_admin, office_location")
    .eq("id", user.id)
    .single();

  // Debug logging
  console.log("Manager Console Debug:", {
    error,
    broker,
    userId: user.id,
  });

  if (error || !broker || !broker.is_manager) {
    console.log("Redirect reason:", {
      hasError: !!error,
      hasBroker: !!broker,
      isManager: broker?.is_manager,
    });
    redirect("/dashboard");
  }

  // Redirect admins to the full admin console
  if (broker.is_admin) {
    redirect("/dashboard/admin");
  }

  // Try to load invite permissions from broker_permissions table
  // If table doesn't exist, default to false
  let canInviteBrokers = false;
  let canInviteAnyOffice = false;

  const { data: permissions } = await supabase
    .from("broker_permissions")
    .select("can_invite_brokers, can_invite_any_office")
    .eq("broker_id", user.id)
    .single();

  if (permissions) {
    canInviteBrokers = permissions.can_invite_brokers ?? false;
    canInviteAnyOffice = permissions.can_invite_any_office ?? false;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ManagerConsole
        userId={user.id}
        officeLocation={broker.office_location}
        canInviteBrokers={canInviteBrokers}
        canInviteAnyOffice={canInviteAnyOffice}
      />
    </div>
  );
}
