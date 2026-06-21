"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Mail,
  ShieldCheck,
  Search,
  Edit,
  Settings,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Trash2,
  UserX,
  UserCheck,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InviteTeamMemberModal from "./InviteTeamMemberModal";
import EditTeamMemberModal from "./EditTeamMemberModal";
import PermissionsModal from "./PermissionsModal";
import DeleteTeamMemberModal from "./DeleteTeamMemberModal";

type TeamMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_admin: boolean | null;
  is_manager: boolean | null;
  is_remote: boolean | null;
  office_location: string | null;
  is_active: boolean | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: "admin" | "manager" | "claims_staff" | "broker" | string;
  is_remote: boolean | null;
  office_location: string | null;
  is_active: boolean | null;
};

// Translate the canonical `profiles.role` enum into the legacy boolean
// shape this UI was originally written against. The DB is authoritative;
// these booleans are derived.
function profileToRow(p: ProfileRow): TeamMemberRow {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    is_admin: p.role === "admin",
    is_manager: p.role === "manager",
    is_remote: p.is_remote,
    office_location: p.office_location,
    is_active: p.is_active,
  };
}

// Translate a desired is_admin/is_manager combo into a single role enum value.
// is_admin trumps is_manager; absence of both means a regular claims_staff user.
function rolesToEnum(
  is_admin: boolean,
  is_manager: boolean,
): "admin" | "manager" | "claims_staff" {
  if (is_admin) return "admin";
  if (is_manager) return "manager";
  return "claims_staff";
}

const PROFILE_SELECT =
  "id, first_name, last_name, email, role, is_remote, office_location, is_active";

export default function TeamMemberTable() {
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMemberRow | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [deactivatedExpanded, setDeactivatedExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Filters
  const [filterOffice, setFilterOffice] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterRemote, setFilterRemote] = useState<boolean | null>(null);
  const [filterActiveStatus, setFilterActiveStatus] = useState<string>("active"); // "all", "active", "inactive"
  const [showFilters, setShowFilters] = useState(false);
  const [officeSortBy, setOfficeSortBy] = useState<"name" | "count">("name");

  // Sorting
  const [sortField, setSortField] = useState<
    "first_name" | "email" | "office_location"
  >("first_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .order("created_at", { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setTeamMembers(((data as ProfileRow[]) || []).map(profileToRow));
      }
      setLoading(false);
    };
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let result = teamMembers.filter(
      (b) =>
        (b.first_name || "").toLowerCase().includes(q) ||
        (b.last_name || "").toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q),
    );

    // Apply active status filter
    if (filterActiveStatus === "active") {
      result = result.filter((b) => b.is_active !== false);
    } else if (filterActiveStatus === "inactive") {
      result = result.filter((b) => b.is_active === false);
    }

    // Apply filters
    if (filterOffice) {
      result = result.filter((b) => b.office_location === filterOffice);
    }

    if (filterRole) {
      if (filterRole === "admin") {
        result = result.filter((b) => b.is_admin === true);
      } else if (filterRole === "manager") {
        result = result.filter((b) => b.is_manager === true && !b.is_admin);
      } else if (filterRole === "teamMember") {
        result = result.filter((b) => !b.is_admin && !b.is_manager);
      }
    }

    if (filterRemote !== null) {
      result = result.filter((b) => b.is_remote === filterRemote);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nulls
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;

      // For names, combine first and last
      if (sortField === "first_name") {
        aVal = `${a.first_name || ""} ${a.last_name || ""}`
          .trim()
          .toLowerCase();
        bVal = `${b.first_name || ""} ${b.last_name || ""}`
          .trim()
          .toLowerCase();
      } else {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    teamMembers,
    query,
    filterOffice,
    filterRole,
    filterRemote,
    filterActiveStatus,
    sortField,
    sortDirection,
  ]);

  // Group filtered results by office location, then by role
  const groupedByOffice = useMemo(() => {
    const active = filtered.filter((b) => b.is_active !== false);

    // Get deactivated accounts separately (ignore active status filter, but apply other filters)
    const q = query.toLowerCase();
    let deactivatedList = teamMembers.filter((b) => b.is_active === false);

    // Apply search filter
    if (query) {
      deactivatedList = deactivatedList.filter(
        (b) =>
          (b.first_name || "").toLowerCase().includes(q) ||
          (b.last_name || "").toLowerCase().includes(q) ||
          b.email.toLowerCase().includes(q),
      );
    }

    // Apply office filter
    if (filterOffice) {
      deactivatedList = deactivatedList.filter((b) => b.office_location === filterOffice);
    }

    // Apply role filter
    if (filterRole) {
      if (filterRole === "admin") {
        deactivatedList = deactivatedList.filter((b) => b.is_admin === true);
      } else if (filterRole === "manager") {
        deactivatedList = deactivatedList.filter((b) => b.is_manager === true && !b.is_admin);
      } else if (filterRole === "teamMember") {
        deactivatedList = deactivatedList.filter((b) => !b.is_admin && !b.is_manager);
      }
    }

    // Apply remote filter
    if (filterRemote !== null) {
      deactivatedList = deactivatedList.filter((b) => b.is_remote === filterRemote);
    }

    // Separate admins (they get their own section)
    const admins = active.filter((b) => b.is_admin === true);

    // Group non-admin teamMembers by office
    const nonAdmins = active.filter((b) => !b.is_admin);
    const officeGroups: Record<string, { managers: TeamMemberRow[], teamMembers: TeamMemberRow[] }> = {};

    nonAdmins.forEach((teamMember) => {
      const office = teamMember.office_location || "Unassigned";
      if (!officeGroups[office]) {
        officeGroups[office] = { managers: [], teamMembers: [] };
      }

      if (teamMember.is_manager) {
        officeGroups[office].managers.push(teamMember);
      } else {
        officeGroups[office].teamMembers.push(teamMember);
      }
    });

    // Sort offices
    const sortedOffices = Object.keys(officeGroups).sort((a, b) => {
      // Put "Unassigned" at the end
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;

      if (officeSortBy === "count") {
        const countA = officeGroups[a].managers.length + officeGroups[a].teamMembers.length;
        const countB = officeGroups[b].managers.length + officeGroups[b].teamMembers.length;
        return countB - countA; // Descending order (most teamMembers first)
      }

      return a.localeCompare(b); // Alphabetical
    });

    return { admins, officeGroups, sortedOffices, deactivated: deactivatedList };
  }, [filtered, officeSortBy, teamMembers, query, filterOffice, filterRole, filterRemote]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const uniqueOffices = useMemo(() => {
    return Array.from(
      new Set(teamMembers.map((b) => b.office_location).filter(Boolean)),
    );
  }, [teamMembers]);

  const activeFilterCount =
    (filterOffice ? 1 : 0) +
    (filterRole ? 1 : 0) +
    (filterRemote !== null ? 1 : 0) +
    (filterActiveStatus !== "active" ? 1 : 0); // Count if not default

  const clearFilters = () => {
    setFilterOffice("");
    setFilterRole("");
    setFilterRemote(null);
    setFilterActiveStatus("active"); // Reset to default (active only)
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (ids: string[], selectAll: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (selectAll ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkUpdate = async (
    update: { is_manager?: boolean; is_active?: boolean }
  ) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = [...selectedIds];

    // Build the profile-level update from the legacy boolean inputs.
    // For role changes via bulk, we only act on non-admins so we don't
    // accidentally demote an admin to manager.
    const profileUpdate: { is_active?: boolean; role?: string } = {};
    if (typeof update.is_active === "boolean") {
      profileUpdate.is_active = update.is_active;
    }
    const roleUpdate =
      typeof update.is_manager === "boolean"
        ? update.is_manager
          ? "manager"
          : "claims_staff"
        : undefined;

    // Optimistic update
    setTeamMembers((prev) =>
      prev.map((b) =>
        ids.includes(b.id)
          ? {
              ...b,
              ...(typeof update.is_active === "boolean"
                ? { is_active: update.is_active }
                : {}),
              ...(typeof update.is_manager === "boolean" && !b.is_admin
                ? { is_manager: update.is_manager }
                : {}),
            }
          : b,
      ),
    );

    let bulkError: { message: string } | null = null;
    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .in("id", ids);
      if (error) bulkError = error;
    }
    if (!bulkError && roleUpdate) {
      // Don't demote existing admins via a bulk manager toggle
      const { error } = await supabase
        .from("profiles")
        .update({ role: roleUpdate })
        .in("id", ids)
        .neq("role", "admin");
      if (error) bulkError = error;
    }

    if (bulkError) {
      const { data: refreshed } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .order("created_at", { ascending: false });
      if (refreshed)
        setTeamMembers((refreshed as ProfileRow[]).map(profileToRow));
      alert(`Bulk update failed: ${bulkError.message}`);
    } else {
      clearSelection();
    }
    setBulkUpdating(false);
  };

  const handleInviteSubmit = async (data: {
    email: string;
    firstName: string;
    lastName: string;
    office: string;
    isRemote: boolean;
    isAdmin: boolean;
    isManager: boolean;
  }): Promise<void> => {
    // Get the current session token
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("No active session");
    }

    // Call API route to create user and teamMember record
    const response = await fetch("/api/admin/invite-team-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to invite team member");
    }

    // Check if email failed but user was created
    if (result.warning) {
      const error: any = new Error(result.warning);
      error.warning = result.warning;
      throw error;
    }

    // Reload teamMembers list
    const { data: updated, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: false });

    if (!error && updated) {
      setTeamMembers((updated as ProfileRow[]).map(profileToRow));
    }
  };

  const toggleAdmin = async (
    id: string,
    current: boolean | null | undefined,
  ) => {
    const newVal = !current;
    // optimistic update
    setTeamMembers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, is_admin: newVal } : b)),
    );
    // Translate the boolean toggle to a role enum change. Revoking admin
    // falls back to claims_staff; the Edit modal is the proper place to
    // promote a user to manager.
    const nextRole = newVal ? "admin" : "claims_staff";
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", id);
    if (error) {
      // revert on error
      setTeamMembers((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, is_admin: current ?? false } : b,
        ),
      );
      alert(`Failed to update admin status: ${error.message}`);
    }
  };

  const handleDeactivate = async (teamMember: TeamMemberRow) => {
    const isCurrentlyActive = teamMember.is_active !== false;
    const action = isCurrentlyActive ? "deactivate" : "reactivate";
    const confirmMessage = isCurrentlyActive
      ? `Deactivate ${teamMember.first_name} ${teamMember.last_name}? They will no longer be able to log in.`
      : `Reactivate ${teamMember.first_name} ${teamMember.last_name}? They will be able to log in again.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const newVal = !isCurrentlyActive;
    // optimistic update
    setTeamMembers((prev) =>
      prev.map((b) => (b.id === teamMember.id ? { ...b, is_active: newVal } : b)),
    );
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newVal })
      .eq("id", teamMember.id);
    if (error) {
      // revert on error
      setTeamMembers((prev) =>
        prev.map((b) =>
          b.id === teamMember.id ? { ...b, is_active: isCurrentlyActive } : b,
        ),
      );
      alert(`Failed to ${action} account: ${error.message}`);
    }
  };

  const handleDeleteTeamMember = async (
    teamMemberId: string,
    confirmEmail: string,
  ): Promise<void> => {
    // Get current session for the bearer token
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const res = await fetch("/api/admin/delete-team-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ teamMemberId, confirmEmail }),
    });

    const result = await res.json();
    if (!res.ok && res.status !== 207) {
      throw new Error(result.error || "Failed to delete team member");
    }

    // Remove from local state
    setTeamMembers((prev) => prev.filter((b) => b.id !== teamMemberId));
    setIsDeleteModalOpen(false);
    setSelectedTeamMember(null);

    const summary = [
      `${result.customersReleased ?? 0} customer(s) moved to Limbo`,
      `${result.tasksReleased ?? 0} task(s) unassigned`,
    ].join(", ");
    if (result.warning) {
      alert(`${result.warning}\n\n${summary}`);
    } else {
      alert(`TeamMember deleted. ${summary}.`);
    }
  };

  const handleEditSubmit = async (data: {
    id: string;
    first_name: string;
    last_name: string;
    office_location: string;
    is_remote: boolean;
    is_admin: boolean;
    is_manager: boolean;
    show_in_directory: boolean;
  }): Promise<void> => {
    // Optimistic update
    setTeamMembers((prev) =>
      prev.map((b) =>
        b.id === data.id
          ? {
            ...b,
            first_name: data.first_name,
            last_name: data.last_name,
            office_location: data.office_location,
            is_remote: data.is_remote,
            is_admin: data.is_admin,
            is_manager: data.is_manager,
          }
          : b,
      ),
    );

    // Translate the boolean role flags to the canonical role enum.
    // show_in_directory is not represented on profiles — it was a
    // team_members (broker entity) concept and is intentionally ignored here.
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        office_location: data.office_location,
        is_remote: data.is_remote,
        role: rolesToEnum(data.is_admin, data.is_manager),
      })
      .eq("id", data.id);

    if (error) {
      // Reload data on error to revert optimistic update
      const { data: updated } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .order("created_at", { ascending: false });
      if (updated) {
        setTeamMembers((updated as ProfileRow[]).map(profileToRow));
      }
      throw error;
    }
  };

  const handleResendInvite = async (teamMember: TeamMemberRow) => {
    if (
      !confirm(
        `Resend invite email to ${teamMember.email}? This will generate a new temporary password.`,
      )
    ) {
      return;
    }

    setResendingInvite(teamMember.id);
    try {
      const response = await fetch("/api/admin/resend-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamMemberId: teamMember.id,
          email: teamMember.email,
          firstName: teamMember.first_name || teamMember.email.split("@")[0],
          lastName: teamMember.last_name || "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to resend invite");
      }

      alert(`Invite email sent successfully to ${teamMember.email}!`);
    } catch (error) {
      console.error("Error resending invite:", error);
      alert(
        `Failed to resend invite: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setResendingInvite(null);
    }
  };

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team members…"
              className="h-10 w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" /> Invite TeamMember
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Filters & Sorting</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {/* Office Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Office Location
                </label>
                <select
                  value={filterOffice}
                  onChange={(e) => setFilterOffice(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">All Offices</option>
                  {uniqueOffices.map((office) => (
                    <option key={office} value={office || ""}>
                      {office}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="teamMember">TeamMember</option>
                </select>
              </div>

              {/* Remote Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Work Location
                </label>
                <select
                  value={
                    filterRemote === null
                      ? ""
                      : filterRemote
                        ? "remote"
                        : "office"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterRemote(val === "" ? null : val === "remote");
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">All</option>
                  <option value="office">Office-based</option>
                  <option value="remote">Remote</option>
                </select>
              </div>

              {/* Active Status Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Account Status
                </label>
                <select
                  value={filterActiveStatus}
                  onChange={(e) => setFilterActiveStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="all">All Accounts</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Office Sort Option */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Office Sections Order
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOfficeSortBy("name")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${officeSortBy === "name"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  Alphabetical
                </button>
                <button
                  onClick={() => setOfficeSortBy("count")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${officeSortBy === "count"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  By TeamMember Count
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-slate-600">
          Showing {filtered.length} of {teamMembers.length} teamMembers
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-orange-800">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-orange-200" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Status:</span>
            <button
              onClick={() => handleBulkUpdate({ is_active: true })}
              disabled={bulkUpdating}
              className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              <UserCheck className="h-3 w-3" /> Activate
            </button>
            <button
              onClick={() => handleBulkUpdate({ is_active: false })}
              disabled={bulkUpdating}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <UserX className="h-3 w-3" /> Deactivate
            </button>
          </div>
          <button
            onClick={clearSelection}
            className="ml-auto rounded p-1 text-orange-600 hover:bg-orange-100"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="p-4 text-sm text-slate-500">Loading team members…</div>
      )}
      {error && <div className="p-4 text-sm text-red-600">Error: {error}</div>}

      {/* Tables Grouped by Office */}
      {!loading && !error && (
        <div className="space-y-6">
          {/* Admins Section - Always at top */}
          {groupedByOffice.admins.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Admins
                <span className="text-xs font-normal text-slate-500">
                  ({groupedByOffice.admins.length})
                </span>
              </h3>
              <div className="overflow-x-auto">
                <TeamMemberRoleTable
                  teamMembers={groupedByOffice.admins}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  handleSort={handleSort}
                  handleResendInvite={handleResendInvite}
                  resendingInvite={resendingInvite}
                  setSelectedTeamMember={setSelectedTeamMember}
                  setIsEditModalOpen={setIsEditModalOpen}
                  setIsPermissionsModalOpen={setIsPermissionsModalOpen}
                  toggleAdmin={toggleAdmin}
                  handleDeactivate={handleDeactivate}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                />
              </div>
            </div>
          )}

          {/* Office Sections */}
          {groupedByOffice.sortedOffices.map((office) => {
            const { managers, teamMembers } = groupedByOffice.officeGroups[office];
            const totalInOffice = managers.length + teamMembers.length;

            if (totalInOffice === 0) return null;

            return (
              <div key={office} className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                    {office.split(',')[0].substring(0, 2).toUpperCase()}
                  </span>
                  {office}
                  <span className="text-sm font-normal text-slate-500">
                    ({totalInOffice} {totalInOffice === 1 ? 'teamMember' : 'teamMembers'})
                  </span>
                </h3>

                <div className="space-y-4">
                  {/* Managers in this office */}
                  {managers.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <ShieldCheck className="h-3 w-3 text-blue-600" />
                        Managers ({managers.length})
                      </h4>
                      <div className="overflow-x-auto">
                        <TeamMemberRoleTable
                          teamMembers={managers}
                          sortField={sortField}
                          sortDirection={sortDirection}
                          handleSort={handleSort}
                          handleResendInvite={handleResendInvite}
                          resendingInvite={resendingInvite}
                          setSelectedTeamMember={setSelectedTeamMember}
                          setIsEditModalOpen={setIsEditModalOpen}
                          setIsPermissionsModalOpen={setIsPermissionsModalOpen}
                          toggleAdmin={toggleAdmin}
                          handleDeactivate={handleDeactivate}
                          selectedIds={selectedIds}
                          onToggleSelect={handleToggleSelect}
                          onSelectAll={handleSelectAll}
                        />
                      </div>
                    </div>
                  )}

                  {/* TeamMembers in this office */}
                  {teamMembers.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <ShieldCheck className="h-3 w-3 text-slate-600" />
                        TeamMembers ({teamMembers.length})
                      </h4>
                      <div className="overflow-x-auto">
                        <TeamMemberRoleTable
                          teamMembers={teamMembers}
                          sortField={sortField}
                          sortDirection={sortDirection}
                          handleSort={handleSort}
                          handleResendInvite={handleResendInvite}
                          resendingInvite={resendingInvite}
                          setSelectedTeamMember={setSelectedTeamMember}
                          setIsEditModalOpen={setIsEditModalOpen}
                          setIsPermissionsModalOpen={setIsPermissionsModalOpen}
                          toggleAdmin={toggleAdmin}
                          handleDeactivate={handleDeactivate}
                          selectedIds={selectedIds}
                          onToggleSelect={handleToggleSelect}
                          onSelectAll={handleSelectAll}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Deactivated Section - Collapsible */}
          {groupedByOffice.deactivated.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50">
              <button
                onClick={() => setDeactivatedExpanded(!deactivatedExpanded)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-red-100"
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-red-600" />
                  Deactivated Accounts
                  <span className="text-xs font-normal text-slate-500">
                    ({groupedByOffice.deactivated.length})
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">
                    {deactivatedExpanded ? "Click to collapse" : "Click to expand"}
                  </span>
                  {deactivatedExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-600" />
                  )}
                </div>
              </button>

              {deactivatedExpanded && (
                <div className="border-t border-red-200 bg-white p-4">
                  <div className="overflow-x-auto">
                    <TeamMemberRoleTable
                      teamMembers={groupedByOffice.deactivated}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      handleSort={handleSort}
                      handleResendInvite={handleResendInvite}
                      resendingInvite={resendingInvite}
                      setSelectedTeamMember={setSelectedTeamMember}
                      setIsEditModalOpen={setIsEditModalOpen}
                      setIsPermissionsModalOpen={setIsPermissionsModalOpen}
                      toggleAdmin={toggleAdmin}
                      handleDeactivate={handleDeactivate}
                      isDeactivatedSection={true}
                      setIsDeleteModalOpen={setIsDeleteModalOpen}
                      selectedIds={selectedIds}
                      onToggleSelect={handleToggleSelect}
                      onSelectAll={handleSelectAll}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No team members found matching your filters.
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <InviteTeamMemberModal
        isOpen={isInviteModalOpen}
        onCloseAction={() => setIsInviteModalOpen(false)}
        onSubmitAction={handleInviteSubmit}
      />

      {/* Edit Modal */}
      <EditTeamMemberModal
        isOpen={isEditModalOpen}
        teamMember={selectedTeamMember}
        onCloseAction={() => {
          setIsEditModalOpen(false);
          setSelectedTeamMember(null);
        }}
        onSubmitAction={handleEditSubmit}
      />

      {/* Permissions Modal */}
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        teamMember={selectedTeamMember}
        onCloseAction={() => {
          setIsPermissionsModalOpen(false);
          setSelectedTeamMember(null);
        }}
        onSuccessAction={() => {
          // Reload teamMembers to refresh display if needed
        }}
      />

      {/* Hard-Delete Modal */}
      <DeleteTeamMemberModal
        isOpen={isDeleteModalOpen}
        teamMember={selectedTeamMember}
        onCloseAction={() => {
          setIsDeleteModalOpen(false);
          setSelectedTeamMember(null);
        }}
        onConfirmAction={handleDeleteTeamMember}
      />
    </div>
  );
}

// Reusable table component for each role section
function TeamMemberRoleTable({
  teamMembers,
  sortField,
  sortDirection,
  handleSort,
  handleResendInvite,
  resendingInvite,
  setSelectedTeamMember,
  setIsEditModalOpen,
  setIsPermissionsModalOpen,
  setIsDeleteModalOpen,
  toggleAdmin,
  handleDeactivate,
  isDeactivatedSection = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: {
  teamMembers: TeamMemberRow[];
  sortField: "first_name" | "email" | "office_location";
  sortDirection: "asc" | "desc";
  handleSort: (field: "first_name" | "email" | "office_location") => void;
  handleResendInvite: (teamMember: TeamMemberRow) => void;
  resendingInvite: string | null;
  setSelectedTeamMember: (teamMember: TeamMemberRow) => void;
  setIsEditModalOpen: (open: boolean) => void;
  setIsPermissionsModalOpen: (open: boolean) => void;
  setIsDeleteModalOpen?: (open: boolean) => void;
  toggleAdmin: (id: string, current: boolean | null | undefined) => void;
  handleDeactivate: (teamMember: TeamMemberRow) => void;
  isDeactivatedSection?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[], selectAll: boolean) => void;
}) {
  const allSelected = teamMembers.length > 0 && teamMembers.every((b) => selectedIds.has(b.id));
  const someSelected = !allSelected && teamMembers.some((b) => selectedIds.has(b.id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);
  return (
    <table className="w-full">
      <thead className="border-b border-slate-200 bg-slate-50">
        <tr>
          <th className="w-8 px-3 py-2">
            <input
              type="checkbox"
              ref={selectAllRef}
              checked={allSelected}
              onChange={(e) => onSelectAll(teamMembers.map((b) => b.id), e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              title="Select all in this section"
            />
          </th>
          <th className="px-3 py-2 text-left text-xs">
            <button
              onClick={() => handleSort("first_name")}
              className="flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
            >
              Name
              {sortField === "first_name" &&
                (sortDirection === "asc" ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                ))}
            </button>
          </th>
          <th className="px-3 py-2 text-left text-xs">
            <button
              onClick={() => handleSort("email")}
              className="flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
            >
              Email
              {sortField === "email" &&
                (sortDirection === "asc" ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                ))}
            </button>
          </th>
          <th className="px-3 py-2 text-left text-xs">
            <button
              onClick={() => handleSort("office_location")}
              className="flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
            >
              Branch
              {sortField === "office_location" &&
                (sortDirection === "asc" ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                ))}
            </button>
          </th>
          <th className="px-3 py-2 text-left text-xs">
            <span className="font-semibold text-slate-700">Role</span>
          </th>
          <th className="px-3 py-2 text-left text-xs">
            <span className="font-semibold text-slate-700">Status</span>
          </th>
          <th className="px-3 py-2 text-left text-xs">
            <span className="font-semibold text-slate-700">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {teamMembers.map((b) => (
          <tr
            key={b.id}
            className={`hover:bg-slate-50 ${selectedIds.has(b.id) ? "bg-orange-50 hover:bg-orange-100" : ""}`}
          >
            <td className="w-8 px-3 py-2">
              <input
                type="checkbox"
                checked={selectedIds.has(b.id)}
                onChange={() => onToggleSelect(b.id)}
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
            </td>
            <td className="px-3 py-2 text-sm font-medium text-slate-900">
              {b.first_name} {b.last_name || ""}
            </td>
            <td className="px-3 py-2 text-sm text-slate-700">{b.email}</td>
            <td className="px-3 py-2 text-sm font-medium text-slate-900">
              {b.office_location
                ? `${b.office_location}${b.is_remote ? " (r)" : ""}`
                : "—"}
            </td>
            <td className="px-3 py-2 text-sm">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${b.is_admin
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : b.is_manager
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
              >
                <ShieldCheck className="h-3 w-3" />{" "}
                {b.is_admin ? "Admin" : b.is_manager ? "Manager" : "TeamMember"}
              </span>
            </td>
            <td className="px-3 py-2 text-sm">
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${b.is_active === false
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                    }`}
                >
                  {b.is_active === false ? "Inactive" : "Active"}
                </span>
              </div>
            </td>
            <td className="px-3 py-2 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleResendInvite(b)}
                  disabled={resendingInvite === b.id}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  <Mail className="h-3 w-3" />
                  {resendingInvite === b.id ? "Sending..." : "Resend Invite"}
                </button>
                <button
                  onClick={() => {
                    setSelectedTeamMember(b);
                    setIsEditModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <Edit className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => {
                    setSelectedTeamMember(b);
                    setIsPermissionsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-purple-700 hover:bg-purple-50"
                  title="Manage Permissions"
                >
                  <Settings className="h-3 w-3" /> Permissions
                </button>
                <button
                  onClick={() => toggleAdmin(b.id, b.is_admin)}
                  className="rounded px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                >
                  {b.is_admin ? "Revoke Admin" : "Make Admin"}
                </button>
                <button
                  onClick={() => handleDeactivate(b)}
                  className={`rounded px-2 py-1 text-xs ${b.is_active === false
                      ? "text-green-700 hover:bg-green-50"
                      : "text-red-700 hover:bg-red-50"
                    }`}
                >
                  {b.is_active === false ? "Reactivate" : "Deactivate"}
                </button>
                {isDeactivatedSection && setIsDeleteModalOpen && (
                  <button
                    onClick={() => {
                      setSelectedTeamMember(b);
                      setIsDeleteModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    title="Permanently delete team member and Supabase Auth account"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
