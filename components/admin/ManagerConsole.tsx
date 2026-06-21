/**
 * ManagerConsole Component - Team Management for Office Managers
 *
 * PERMISSIONS: Managers only (not admins)
 * SCOPE: Office-level team management
 *
 * FEATURES:
 * - View/Invite/Edit team members in their office
 * - Reassign customers between team members
 * - View office analytics and activity metrics
 * - CANNOT deactivate accounts (admin-only)
 * - CANNOT access API tokens (admin-only)
 * - CANNOT access email management (admin-only)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopOnlyView from "@/components/DesktopOnlyView";
import { useIsMobileOrTablet } from "@/lib/hooks/useMediaQuery";
import {
  Plus,
  Mail,
  Search,
  Edit,
  Users,
  TrendingUp,
  Building2,
  MapPin,
  BarChart3,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InviteTeamMemberModal from "./InviteTeamMemberModal";
import EditTeamMemberModal from "./EditTeamMemberModal";
import TeamMemberReassignment from "./TeamMemberReassignment";
import CompanyAnalytics from "./CompanyAnalytics";
import ActivityAnalytics from "./ActivityAnalytics";

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

type ManagerConsoleProps = {
  userId: string;
  officeLocation: string | null;
  canInviteTeamMembers: boolean;
  canInviteAnyOffice: boolean;
};

export default function ManagerConsole({
  userId,
  officeLocation,
  canInviteTeamMembers,
  canInviteAnyOffice,
}: ManagerConsoleProps) {
  const supabase = createClient();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMemberRow | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "team"
    | "reassign"
    | "analytics"
    | "activity"
  >("team");

  // Show desktop-only message on mobile/tablet
  if (isMobileOrTablet) {
    return (
      <DesktopOnlyView
        pageName="Manager Console"
        reason="Team management, analytics, and reassignment tools require a desktop environment."
        mobileAlternative={{
          href: "/dashboard",
          label: "Back to Dashboard",
        }}
      />
    );
  }

  // Load teamMembers from the manager's office
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // Managers see only their office unless they have can_invite_any_office permission
      let query = supabase
        .from("team_members")
        .select(
          "id, first_name, last_name, email, is_admin, is_manager, is_remote, office_location, is_active",
        )
        .eq("is_active", true) // Only show active team members
        .order("created_at", { ascending: false });

      // Restrict to office if manager doesn't have can_invite_any_office
      if (!canInviteAnyOffice && officeLocation) {
        query = query.eq("office_location", officeLocation);
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
      } else {
        setTeamMembers(data || []);
      }
      setLoading(false);
    };
    load();
  }, [supabase, officeLocation, canInviteAnyOffice]);

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
      .from("team_members")
      .select(
        "id, first_name, last_name, email, is_admin, is_manager, is_remote, office_location, is_active",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && updated) {
      setTeamMembers(updated);
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
  }): Promise<void> => {
    const { error } = await supabase
      .from("team_members")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        office_location: data.office_location,
        is_remote: data.is_remote,
        is_admin: data.is_admin,
        is_manager: data.is_manager,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

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
  };

  const handleResendInvite = async (email: string) => {
    setResendingInvite(email);
    try {
      const response = await fetch("/api/admin/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to resend invite");
      }

      alert("Invite resent successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setResendingInvite(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return teamMembers.filter(
      (b) =>
        (b.first_name || "").toLowerCase().includes(q) ||
        (b.last_name || "").toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.office_location || "").toLowerCase().includes(q),
    );
  }, [teamMembers, query]);

  // Calculate office metrics
  const metrics = useMemo(() => {
    const totalTeamMembers = teamMembers.length;
    const managers = teamMembers.filter((b) => b.is_manager && !b.is_admin).length;
    const remoteTeamMembers = teamMembers.filter((b) => b.is_remote).length;
    return { totalTeamMembers, managers, remoteTeamMembers };
  }, [teamMembers]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Manager Console</h1>
        <p className="mt-2 text-sm text-zinc-900">
          Manage your team{" "}
          {officeLocation && !canInviteAnyOffice && (
            <span className="font-medium text-slate-700">
              ({officeLocation} Office)
            </span>
          )}
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "team"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Users className="h-4 w-4" /> Team
        </button>
        <button
          onClick={() => setActiveTab("reassign")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "reassign"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Users className="h-4 w-4" /> Reassign
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "analytics"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Office Analytics
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "activity"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Activity className="h-4 w-4" /> Activity
        </button>
      </div>

      {/* Tab Panels */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {activeTab === "team" && (
          <TeamManagementTab
            teamMembers={teamMembers}
            loading={loading}
            error={error}
            query={query}
            setQuery={setQuery}
            canInviteTeamMembers={canInviteTeamMembers}
            setIsInviteModalOpen={setIsInviteModalOpen}
            setSelectedTeamMember={setSelectedTeamMember}
            setIsEditModalOpen={setIsEditModalOpen}
            handleResendInvite={handleResendInvite}
            resendingInvite={resendingInvite}
            officeLocation={officeLocation}
            canInviteAnyOffice={canInviteAnyOffice}
          />
        )}
        {activeTab === "reassign" && (
          <TeamMemberReassignment officeFilter={canInviteAnyOffice ? null : officeLocation} />
        )}
        {activeTab === "analytics" && (
          <CompanyAnalytics officeFilter={officeLocation} />
        )}
        {activeTab === "activity" && (
          <ActivityAnalytics officeFilter={officeLocation} />
        )}
      </div>

      {/* Modals */}
      <InviteTeamMemberModal
        isOpen={isInviteModalOpen}
        onCloseAction={() => setIsInviteModalOpen(false)}
        onSubmitAction={handleInviteSubmit}
        restrictedOffice={
          canInviteAnyOffice ? undefined : officeLocation || undefined
        }
      />

      {selectedTeamMember && (
        <EditTeamMemberModal
          isOpen={isEditModalOpen}
          onCloseAction={() => {
            setIsEditModalOpen(false);
            setSelectedTeamMember(null);
          }}
          onSubmitAction={handleEditSubmit}
          teamMember={selectedTeamMember}
          isAdmin={false} // Managers cannot change role permissions
        />
      )}
    </div>
  );
}

// Team Management Tab Component
function TeamManagementTab({
  teamMembers,
  loading,
  error,
  query,
  setQuery,
  canInviteTeamMembers,
  setIsInviteModalOpen,
  setSelectedTeamMember,
  setIsEditModalOpen,
  handleResendInvite,
  resendingInvite,
  officeLocation,
  canInviteAnyOffice,
}: {
  teamMembers: TeamMemberRow[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  canInviteTeamMembers: boolean;
  setIsInviteModalOpen: (open: boolean) => void;
  setSelectedTeamMember: (teamMember: TeamMemberRow) => void;
  setIsEditModalOpen: (open: boolean) => void;
  handleResendInvite: (email: string) => void;
  resendingInvite: string | null;
  officeLocation: string | null;
  canInviteAnyOffice: boolean;
}) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return teamMembers.filter(
      (b) =>
        (b.first_name || "").toLowerCase().includes(q) ||
        (b.last_name || "").toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.office_location || "").toLowerCase().includes(q),
    );
  }, [teamMembers, query]);

  // Calculate office metrics
  const metrics = useMemo(() => {
    const totalTeamMembers = teamMembers.length;
    const managers = teamMembers.filter((b) => b.is_manager && !b.is_admin).length;
    const remoteTeamMembers = teamMembers.filter((b) => b.is_remote).length;
    return { totalTeamMembers, managers, remoteTeamMembers };
  }, [teamMembers]);

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-900">
                Total Team Members
              </p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {metrics.totalTeamMembers}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-900">Managers</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {metrics.managers}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-900">
                Remote TeamMembers
              </p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {metrics.remoteTeamMembers}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search team members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-500 focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/20"
          />
        </div>
        {canInviteTeamMembers && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white hover:bg-[#d14d00] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Invite TeamMember
          </button>
        )}
      </div>

      {/* Team Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Loading team members...
          </div>
        )}

        {error && (
          <div className="px-6 py-12 text-center text-sm text-red-600">
            Error: {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-zinc-900">
            {query
              ? "No team members found matching your search."
              : "No team members found."}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-900">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-900">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-900">
                    Office
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((teamMember) => {
                  const fullName = [teamMember.first_name, teamMember.last_name]
                    .filter(Boolean)
                    .join(" ");
                  const role = teamMember.is_admin
                    ? "Admin"
                    : teamMember.is_manager
                      ? "Manager"
                      : "TeamMember";
                  const location = teamMember.is_remote
                    ? "Remote"
                    : teamMember.office_location || "—";

                  return (
                    <tr key={teamMember.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                        {fullName || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900">
                        {teamMember.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            teamMember.is_admin
                              ? "bg-red-100 text-red-700"
                              : teamMember.is_manager
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {role}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900">
                        {location}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedTeamMember(teamMember);
                              setIsEditModalOpen(true);
                            }}
                            className="rounded p-1 text-zinc-900 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit team member"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleResendInvite(teamMember.email)}
                            disabled={resendingInvite === teamMember.email}
                            className="rounded p-1 text-zinc-900 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                            title="Resend welcome email"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
