/**
 * Office Manager Reports Page - Claims Analytics
 *
 * Features:
 * - Office-level claims KPIs
 * - Team member claims breakdown for the manager's office
 * - Overdue task tracking
 *
 * Access: Office managers only (is_manager = true)
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  FileText,
  DollarSign,
} from "lucide-react";

type TeamMemberStats = {
  team_member_id: string;
  team_member_name: string;
  total_claims: number;
  open_claims: number;
  closed_claims: number;
  total_exposure: number;
};

type OverdueTask = {
  id: string;
  title: string;
  team_member_id: string;
  due_date: string;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const NO_MEMBERS_SENTINEL = "00000000-0000-0000-0000-000000000000";

export default function OfficeReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [managerOffice, setManagerOffice] = useState<string | null>(null);
  const [teamMemberStats, setTeamMemberStats] = useState<TeamMemberStats[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(
    null,
  );

  const [officeStats, setOfficeStats] = useState({
    total_claims: 0,
    open_claims: 0,
    closed_claims: 0,
    total_exposure: 0,
    overdue_tasks: 0,
  });

  // Check authorization and load manager's office
  useEffect(() => {
    const authorize = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data: teamMember, error: fetchError } = await supabase
          .from("team_members")
          .select("is_manager, office_location")
          .eq("id", user.id)
          .single();

        if (fetchError || !teamMember?.is_manager) {
          router.push("/dashboard/reports");
          return;
        }

        setManagerOffice(teamMember.office_location);
        setIsManager(true);
      } catch (err) {
        console.error("Authorization error:", err);
        setError("Authorization failed");
      }
    };

    authorize();
  }, [supabase, router]);

  // Load claims analytics for the manager's office
  useEffect(() => {
    if (!isManager || !managerOffice) return;

    const loadOfficeAnalytics = async () => {
      try {
        setLoading(true);

        // Team members in this office
        const { data: members, error: memberError } = await supabase
          .from("team_members")
          .select("id, first_name, last_name")
          .eq("office_location", managerOffice);

        if (memberError) throw memberError;

        const memberIds = (members ?? []).map((m) => m.id);
        const idFilter = memberIds.length ? memberIds : [NO_MEMBERS_SENTINEL];

        // Claims assigned to those team members, joined to their status
        const { data: claims, error: claimError } = await supabase
          .from("claims")
          .select(
            `id, team_member_id, damage_claim_amount, closed_at,
             status:claim_statuses!claims_status_id_fkey(is_closed)`,
          )
          .in("team_member_id", idFilter);

        if (claimError) throw claimError;

        const statsMap = new Map<string, TeamMemberStats>();
        (members ?? []).forEach((m) => {
          statsMap.set(m.id, {
            team_member_id: m.id,
            team_member_name:
              [m.first_name, m.last_name].filter(Boolean).join(" ") || m.id,
            total_claims: 0,
            open_claims: 0,
            closed_claims: 0,
            total_exposure: 0,
          });
        });

        type ClaimRow = {
          team_member_id: string | null;
          damage_claim_amount: number | null;
          closed_at: string | null;
          status: { is_closed: boolean } | { is_closed: boolean }[] | null;
        };

        const claimRows = (claims as unknown as ClaimRow[] | null) ?? [];
        claimRows.forEach((c) => {
          const s = statsMap.get(c.team_member_id ?? "");
          if (!s) return;
          s.total_claims += 1;
          const statusClosed = Array.isArray(c.status)
            ? c.status.some((st) => st.is_closed)
            : c.status?.is_closed ?? false;
          if (statusClosed || c.closed_at) {
            s.closed_claims += 1;
          } else {
            s.open_claims += 1;
          }
          s.total_exposure += Number(c.damage_claim_amount ?? 0);
        });

        const stats = Array.from(statsMap.values()).sort(
          (a, b) => b.total_claims - a.total_claims,
        );
        setTeamMemberStats(stats);

        // Overdue tasks for this office
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("id, title, team_member_id, due_date")
          .eq("status", "overdue")
          .in("team_member_id", idFilter);

        if (taskError) throw taskError;

        setOverdueTasks(taskData ?? []);

        setOfficeStats({
          total_claims: stats.reduce((sum, s) => sum + s.total_claims, 0),
          open_claims: stats.reduce((sum, s) => sum + s.open_claims, 0),
          closed_claims: stats.reduce((sum, s) => sum + s.closed_claims, 0),
          total_exposure: stats.reduce((sum, s) => sum + s.total_exposure, 0),
          overdue_tasks: (taskData ?? []).length,
        });

        setError(null);
      } catch (err) {
        console.error("Failed to load office analytics:", err);
        setError("Failed to load office analytics");
      } finally {
        setLoading(false);
      }
    };

    loadOfficeAnalytics();
  }, [isManager, managerOffice, supabase]);

  const selectedTeamMemberData = useMemo(() => {
    return teamMemberStats.find(
      (b) => b.team_member_id === selectedTeamMember,
    );
  }, [teamMemberStats, selectedTeamMember]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {managerOffice} Office Reports
        </h1>
        <p className="mt-1 text-slate-600">
          Claims metrics for your office
        </p>
      </div>

      {/* Office KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Claims</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {officeStats.total_claims}
              </p>
            </div>
            <FileText className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Open Claims</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {officeStats.open_claims}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Closed Claims</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {officeStats.closed_claims}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Exposure</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {fmtMoney(officeStats.total_exposure)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-amber-500" />
          </div>
        </div>
      </div>

      {/* TeamMember Claims Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            TeamMember Claims
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Click a team member to view detailed metrics
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  TeamMember Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Total Claims
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Open
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Closed
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Exposure
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamMemberStats.map((teamMember) => (
                <tr
                  key={teamMember.team_member_id}
                  onClick={() =>
                    setSelectedTeamMember(
                      selectedTeamMember === teamMember.team_member_id
                        ? null
                        : teamMember.team_member_id,
                    )
                  }
                  className={`cursor-pointer transition-colors ${selectedTeamMember === teamMember.team_member_id
                    ? "bg-orange-50"
                    : "hover:bg-slate-50"
                    }`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {teamMember.team_member_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {teamMember.total_claims}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {teamMember.open_claims}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">
                    {teamMember.closed_claims}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {fmtMoney(teamMember.total_exposure)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected TeamMember Details */}
      {selectedTeamMemberData && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedTeamMemberData.team_member_name} - Detailed Metrics
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                This team member's claims breakdown
              </p>
            </div>
            <button
              onClick={() => setSelectedTeamMember(null)}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Close
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-slate-600">Open vs Closed</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Open:</span>
                  <span className="font-semibold">
                    {selectedTeamMemberData.open_claims}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Closed:</span>
                  <span className="font-semibold text-green-600">
                    {selectedTeamMemberData.closed_claims}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-slate-600">Exposure</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {fmtMoney(selectedTeamMemberData.total_exposure)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overdue Tasks List */}
      {overdueTasks.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Calendar className="h-5 w-5 text-red-500" />
              Overdue Tasks ({overdueTasks.length})
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tasks that need immediate attention
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {overdueTasks.map((task) => (
              <div key={task.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {teamMemberStats.find(
                      (t) => t.team_member_id === task.team_member_id,
                    )?.team_member_name ?? ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
