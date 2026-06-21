/**
 * Manager Console Page - NTS Claims Tracker
 *
 * PERMISSIONS: Accessible to managers (is_manager = true) who are not admins
 * PURPOSE: Manage team members within their office location
 *
 * FEATURES:
 * - View teamMembers in their office
 * - Invite new teamMembers (restricted to their office unless can_invite_any_office)
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
  const { data: teamMember, error } = await supabase
    .from("team_members")
    .select("is_manager, is_admin, office_location")
    .eq("id", user.id)
    .single();

  // Debug logging
  console.log("Manager Console Debug:", {
    error,
    teamMember,
    userId: user.id,
  });

  if (error || !teamMember || !teamMember.is_manager) {
    console.log("Redirect reason:", {
      hasError: !!error,
      hasTeamMember: !!teamMember,
      isManager: teamMember?.is_manager,
    });
    redirect("/dashboard");
  }

  // Redirect admins to the full admin console
  if (teamMember.is_admin) {
    redirect("/dashboard/admin");
  }

  // Try to load invite permissions from broker_permissions table
  // If table doesn't exist, default to false
  let canInviteTeamMembers = false;
  let canInviteAnyOffice = false;

  const { data: permissions } = await supabase
    .from("team_member_permissions")
    .select("can_invite_brokers, can_invite_any_office")
    .eq("team_member_id", user.id)
    .single();

  if (permissions) {
    canInviteTeamMembers = permissions.can_invite_brokers ?? false;
    canInviteAnyOffice = permissions.can_invite_any_office ?? false;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ManagerConsole
        userId={user.id}
        officeLocation={teamMember.office_location}
        canInviteTeamMembers={canInviteTeamMembers}
        canInviteAnyOffice={canInviteAnyOffice}
      />
    </div>
  );
}
