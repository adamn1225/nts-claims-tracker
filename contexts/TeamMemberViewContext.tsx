"use client";

/**
 * TeamMemberViewContext (claims-tracker adapter)
 * --------------------------------------------------------------------------
 * This context originally came from the sales-tracker fork, where every
 * signed-in user was a "teamMember" and `broker_permissions` was a real table.
 *
 * In claims-tracker the authoritative user table is `profiles` and roles
 * are expressed by the `role` enum (admin / manager / claims_staff /
 * teamMember). To avoid touching every consumer (Kanban, TeamMemberSelector,
 * dashboard page, etc.) right now, this file keeps the same public API
 * (`useTeamMemberView`, `usePermissions`, `currentTeamMember`, `viewingTeamMember`,
 * `viewableTeamMembers`, etc.) but loads everything from `profiles` and
 * derives the legacy `is_admin` / `is_manager` booleans from `role`.
 *
 * Permissions come from `createFallbackPermissions(...)` in
 * `lib/permissions.ts` — no `broker_permissions` table query.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TeamMemberPermissions,
  TeamMember,
  canViewTeamMember,
  canEditCustomer,
  canManageUsers,
  canManageStatuses,
  canViewAnalytics,
  canExportData,
  canEditTask,
  createFallbackPermissions,
} from "@/lib/permissions";

interface TeamMemberViewContextType {
  currentTeamMember: TeamMember | null;
  viewingTeamMember: TeamMember | null;
  setViewingTeamMember: (teamMember: TeamMember | null) => void;
  permissions: TeamMemberPermissions | null;
  viewableTeamMembers: TeamMember[];
  loading: boolean;
  permissionsLoading: boolean;

  canViewTeamMemberData: (targetTeamMember: TeamMember) => boolean;
  canEditCustomerData: (
    customerTeamMemberId: string,
    customerOffice: string | null,
  ) => boolean;
  canManageUsersData: () => boolean;
  canManageStatusesData: () => boolean;
  canViewAnalyticsData: () => boolean;
  canExportDataData: () => boolean;
  canEditTaskData: (taskTeamMemberId: string, taskOffice: string | null) => boolean;

  resetView: () => void;
}

const TeamMemberViewContext = createContext<TeamMemberViewContextType | undefined>(
  undefined,
);

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  office_location: string | null;
  is_remote: boolean | null;
  is_active: boolean | null;
  role: "admin" | "manager" | "claims_staff" | "teamMember" | null;
};

function profileToTeamMember(p: ProfileRow): TeamMember {
  const fallbackFirst =
    (p.full_name ?? "").trim().split(/\s+/)[0] ||
    (p.email ?? "").split("@")[0] ||
    "User";
  const fallbackLast = (p.full_name ?? "")
    .trim()
    .split(/\s+/)
    .slice(1)
    .join(" ");

  return {
    id: p.id,
    email: p.email ?? "",
    first_name: p.first_name ?? fallbackFirst,
    last_name: p.last_name ?? (fallbackLast || undefined),
    office_location: p.office_location ?? null,
    is_admin: p.role === "admin",
    is_manager: p.role === "manager",
    is_sales_coach: false,
    is_remote: p.is_remote ?? null,
    is_active: p.is_active ?? true,
  };
}

const PROFILE_COLUMNS =
  "id, email, first_name, last_name, full_name, office_location, is_remote, is_active, role";

export function TeamMemberViewProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [currentTeamMember, setCurrentTeamMember] = useState<TeamMember | null>(null);
  const [viewingTeamMember, setViewingTeamMember] = useState<TeamMember | null>(null);
  const [permissions, setPermissions] = useState<TeamMemberPermissions | null>(
    null,
  );
  const [viewableTeamMembers, setViewableTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Load current profile
  useEffect(() => {
    const loadCurrent = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          setPermissionsLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("TeamMemberViewContext: error loading profile", error);
          setLoading(false);
          setPermissionsLoading(false);
          return;
        }
        if (!profile) {
          setLoading(false);
          setPermissionsLoading(false);
          return;
        }

        const teamMember = profileToTeamMember(profile as ProfileRow);
        setCurrentTeamMember(teamMember);
        setViewingTeamMember(teamMember);
        setPermissions(createFallbackPermissions(teamMember));
      } catch (err) {
        console.error("TeamMemberViewContext: unexpected error", err);
      } finally {
        setLoading(false);
        setPermissionsLoading(false);
      }
    };

    loadCurrent();
  }, [supabase]);

  // Load viewable teammates
  useEffect(() => {
    if (!currentTeamMember || !permissions) return;

    const loadViewable = async () => {
      try {
        let query = supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .order("first_name", { ascending: true, nullsFirst: false });

        if (
          !permissions.can_view_all_brokers &&
          permissions.can_view_office_brokers &&
          currentTeamMember.office_location
        ) {
          query = query.eq("office_location", currentTeamMember.office_location);
        }

        const { data, error } = await query;
        if (error) {
          console.error("TeamMemberViewContext: viewable load error", error);
          return;
        }
        if (!data) return;

        const isElevated = currentTeamMember.is_admin || currentTeamMember.is_manager;
        const mapped = (data as ProfileRow[])
          .map(profileToTeamMember)
          .filter(
            (b) =>
              canViewTeamMember(permissions, currentTeamMember, b) &&
              (isElevated || b.is_active !== false),
          );

        setViewableTeamMembers(mapped);
      } catch (err) {
        console.error("TeamMemberViewContext: viewable unexpected error", err);
      }
    };

    loadViewable();
  }, [currentTeamMember, permissions, supabase]);

  const canViewTeamMemberData = (targetTeamMember: TeamMember) => {
    if (!currentTeamMember || !permissions) return false;
    return canViewTeamMember(permissions, currentTeamMember, targetTeamMember);
  };

  const canEditCustomerData = (
    customerTeamMemberId: string,
    customerOffice: string | null,
  ) => {
    if (!currentTeamMember || !permissions) return false;
    return canEditCustomer(
      permissions,
      currentTeamMember,
      customerTeamMemberId,
      customerOffice,
    );
  };

  const canManageUsersData = () => {
    if (!currentTeamMember || !permissions) return false;
    return canManageUsers(permissions, currentTeamMember);
  };

  const canManageStatusesData = () => {
    if (!currentTeamMember || !permissions) return false;
    return canManageStatuses(permissions, currentTeamMember);
  };

  const canViewAnalyticsData = () => {
    if (!currentTeamMember || !permissions) return false;
    return canViewAnalytics(permissions, currentTeamMember);
  };

  const canExportDataData = () => {
    if (!currentTeamMember || !permissions) return false;
    return canExportData(permissions, currentTeamMember);
  };

  const canEditTaskData = (taskTeamMemberId: string, taskOffice: string | null) => {
    if (!currentTeamMember || !permissions) return false;
    return canEditTask(permissions, currentTeamMember, taskTeamMemberId, taskOffice);
  };

  const resetView = () => {
    setViewingTeamMember(currentTeamMember);
  };

  const value: TeamMemberViewContextType = {
    currentTeamMember,
    viewingTeamMember,
    setViewingTeamMember,
    permissions,
    viewableTeamMembers,
    loading,
    permissionsLoading,
    canViewTeamMemberData,
    canEditCustomerData,
    canManageUsersData,
    canManageStatusesData,
    canViewAnalyticsData,
    canExportDataData,
    canEditTaskData,
    resetView,
  };

  return (
    <TeamMemberViewContext.Provider value={value}>
      {children}
    </TeamMemberViewContext.Provider>
  );
}

export function useTeamMemberView() {
  const context = useContext(TeamMemberViewContext);
  if (context === undefined) {
    throw new Error("useTeamMemberView must be used within a TeamMemberViewProvider");
  }
  return context;
}

export function usePermissions() {
  const {
    permissions,
    currentTeamMember,
    permissionsLoading,
    canViewTeamMemberData,
    canEditCustomerData,
    canManageUsersData,
    canManageStatusesData,
    canViewAnalyticsData,
    canExportDataData,
    canEditTaskData,
  } = useTeamMemberView();

  return {
    permissions,
    currentTeamMember,
    permissionsLoading,
    canViewTeamMember: canViewTeamMemberData,
    canEditCustomer: canEditCustomerData,
    canManageUsers: canManageUsersData,
    canManageStatuses: canManageStatusesData,
    canViewAnalytics: canViewAnalyticsData,
    canExportData: canExportDataData,
    canEditTask: canEditTaskData,
  };
}
