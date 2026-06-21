/**
 * Office Manager Reports Page - Office-specific Analytics
 *
 * Features:
 * - Office-level KPIs
 * - TeamMember breakdown for the manager's office
 * - Drill-down to individual teamMember weekly performance
 * - Overdue tasks and follow-up tracking
 *
 * Access: Office managers only (is_manager = true)
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
  BarChart3,
} from "lucide-react";

type TeamMemberStats = {
  team_member_id: string;
  team_member_name: string;
  office_location: string;
  total_customers: number;
  prospect_count: number;
  active_count: number;
  won_count: number;
  lost_count: number;
  win_rate_pct: number;
};

type OverdueTask = {
  id: string;
  title: string;
  team_member_id: string;
  customer_id: string;
  due_date: string;
};

export default function OfficeReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [managerOffice, setManagerOffice] = useState<string | null>(null);
  const [teamMemberStats, setTeamMemberStats] = useState<TeamMemberStats[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(null);

  const [officeStats, setOfficeStats] = useState({
    total_customers: 0,
    won_count: 0,
    win_rate_pct: 0,
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

  // Load analytics for manager's office
  useEffect(() => {
    if (!isManager || !managerOffice) return;

    const loadOfficeAnalytics = async () => {
      try {
        setLoading(true);

        // Get teamMember stats for this office
        const { data: teamMemberData, error: teamMemberError } = await supabase
          .from("broker_customer_summary")
          .select("*")
          .eq("office_location", managerOffice);

        if (teamMemberError) throw teamMemberError;

        setTeamMemberStats(teamMemberData || []);

        // Calculate office-level stats
        const totalCustomers = (teamMemberData || []).reduce(
          (sum, b) => sum + (b.total_customers || 0),
          0,
        );
        const totalWon = (teamMemberData || []).reduce(
          (sum, b) => sum + (b.won_count || 0),
          0,
        );
        const totalConverted = (teamMemberData || []).reduce((sum, b) => {
          const converted =
            (b.active_count || 0) + (b.won_count || 0) + (b.lost_count || 0);
          return sum + converted;
        }, 0);
        const officeWinRate =
          totalConverted > 0
            ? Math.round((totalWon / totalConverted) * 100)
            : 0;

        // Get overdue tasks for this office
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("id, title, team_member_id, customer_id, due_date")
          .eq("status", "overdue")
          .in(
            "team_member_id",
            (teamMemberData || []).map((b) => b.team_member_id),
          );

        if (taskError) throw taskError;

        setOverdueTasks(taskData || []);

        setOfficeStats({
          total_customers: totalCustomers,
          won_count: totalWon,
          win_rate_pct: officeWinRate,
          overdue_tasks: (taskData || []).length,
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

  // Filter teamMember stats by selected team member
  const filteredTeamMemberStats = useMemo(() => {
    if (!selectedTeamMember) return teamMemberStats;
    return teamMemberStats.filter((b) => b.team_member_id === selectedTeamMember);
  }, [teamMemberStats, selectedTeamMember]);

  const selectedTeamMemberData = useMemo(() => {
    return teamMemberStats.find((b) => b.team_member_id === selectedTeamMember);
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
          Performance metrics for your office
        </p>
      </div>

      {/* Office KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Customers */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Customers</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {officeStats.total_customers}
              </p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        {/* Won Customers */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Won Customers</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {officeStats.won_count}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        {/* Win Rate */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Win Rate</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {officeStats.win_rate_pct}%
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Overdue Tasks</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {officeStats.overdue_tasks}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* TeamMember Performance Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            TeamMember Performance
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
                  Total Customers
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Prospects
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Won
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Win Rate
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
                  className={`cursor-pointer transition-colors ${
                    selectedTeamMember === teamMember.team_member_id
                      ? "bg-orange-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {teamMember.team_member_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {teamMember.total_customers}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {teamMember.prospect_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {teamMember.active_count}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">
                    {teamMember.won_count}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                    {teamMember.win_rate_pct}%
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
                This teamMember's full performance breakdown
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
              <p className="text-xs text-slate-600">Prospect Conversion Rate</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {selectedTeamMemberData.prospect_count > 0
                  ? Math.round(
                      ((selectedTeamMemberData.active_count +
                        selectedTeamMemberData.won_count) /
                        (selectedTeamMemberData.prospect_count +
                          selectedTeamMemberData.active_count +
                          selectedTeamMemberData.won_count)) *
                        100,
                    )
                  : 0}
                %
              </p>
            </div>

            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-slate-600">Customer Status Mix</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Prospects:</span>
                  <span className="font-semibold">
                    {selectedTeamMemberData.prospect_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="font-semibold">
                    {selectedTeamMemberData.active_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Won:</span>
                  <span className="font-semibold text-green-600">
                    {selectedTeamMemberData.won_count}
                  </span>
                </div>
              </div>
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
                  <button className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    View Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
