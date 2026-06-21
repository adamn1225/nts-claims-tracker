"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Users,
  UserCheck,
  Calendar,
  TrendingUp,
  Activity,
  Loader,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TeamMemberActivity = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  office_location: string | null;
  last_login: string | null;
  recent_actions: number;
  days_since_last_activity: number | null;
};

type ActivityStats = {
  totalTeamMembers: number;
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  inactiveTeamMembers: number;
};

type ActivityAnalyticsProps = {
  officeFilter?: string | null;
};

export default function ActivityAnalytics({ officeFilter }: ActivityAnalyticsProps = {}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ActivityStats>({
    totalTeamMembers: 0,
    activeToday: 0,
    activeThisWeek: 0,
    activeThisMonth: 0,
    inactiveTeamMembers: 0,
  });
  const [teamMemberActivity, setTeamMemberActivity] = useState<TeamMemberActivity[]>([]);
  const [timeframe, setTimeframe] = useState<"today" | "week" | "month">(
    "week",
  );

  useEffect(() => {
    loadAnalytics();
  }, [timeframe, officeFilter]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 30);

      // Fetch all team members with their details (filter by office if provided)
      let teamMembersQuery = supabase
        .from("team_members")
        .select("id, first_name, last_name, email, office_location, updated_at");
      
      // Apply office filter if provided
      if (officeFilter) {
        teamMembersQuery = teamMembersQuery.eq("office_location", officeFilter);
      }
      
      const { data: teamMembersData, error: teamMembersError } = await teamMembersQuery;

      if (teamMembersError) {
        console.error("TeamMembers error:", teamMembersError);
        throw new Error(`Failed to fetch team members: ${teamMembersError.message}`);
      }

      // Fetch all tasks to track teamMember activity
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("team_member_id, created_at");

      if (tasksError) {
        console.error("Tasks error:", tasksError);
        // Don't throw - tasks might not exist yet
      }

      // Fetch all customers to track teamMember activity
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("team_member_id, updated_at");

      if (customersError) {
        console.error("Customers error:", customersError);
        // Don't throw - customers might not exist yet
      }

      // Process teamMember activity
      const processedActivity: TeamMemberActivity[] =
        teamMembersData?.map((teamMember) => {
          // Aggregate all teamMember activities (task creation, customer updates)
          const teamMemberTaskActivities = (tasksData || [])
            .filter((t) => t.team_member_id === teamMember.id)
            .map((t) => new Date(t.created_at));

          const teamMemberCustomerActivities = (customersData || [])
            .filter((c) => c.team_member_id === teamMember.id)
            .map((c) => new Date(c.updated_at));

          const allActivities = [
            ...teamMemberTaskActivities,
            ...teamMemberCustomerActivities,
            new Date(teamMember.updated_at),
          ];

          // Find most recent activity
          const lastActivity =
            allActivities.length > 0
              ? allActivities.reduce((latest, current) =>
                  current > latest ? current : latest,
                )
              : null;

          // Count recent actions based on selected timeframe
          let startDate = weekStart;
          if (timeframe === "today") startDate = todayStart;
          else if (timeframe === "month") startDate = monthStart;

          const recentActions = [
            ...teamMemberTaskActivities,
            ...teamMemberCustomerActivities,
          ].filter((date) => date >= startDate).length;

          // Calculate days since last activity
          const daysSinceActivity = lastActivity
            ? Math.floor(
                (now.getTime() - lastActivity.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null;

          return {
            id: teamMember.id,
            first_name: teamMember.first_name,
            last_name: teamMember.last_name,
            email: teamMember.email,
            office_location: teamMember.office_location,
            last_login: lastActivity ? lastActivity.toISOString() : null,
            recent_actions: recentActions,
            days_since_last_activity: daysSinceActivity,
          };
        }) || [];

      // Sort by most recently active
      processedActivity.sort((a, b) => {
        if (!a.last_login && !b.last_login) return 0;
        if (!a.last_login) return 1;
        if (!b.last_login) return -1;
        return (
          new Date(b.last_login).getTime() - new Date(a.last_login).getTime()
        );
      });

      // Calculate stats
      const activeToday = processedActivity.filter(
        (b) => b.last_login && new Date(b.last_login) >= todayStart,
      ).length;

      const activeThisWeek = processedActivity.filter(
        (b) => b.last_login && new Date(b.last_login) >= weekStart,
      ).length;

      const activeThisMonth = processedActivity.filter(
        (b) => b.last_login && new Date(b.last_login) >= monthStart,
      ).length;

      const inactiveTeamMembers = processedActivity.filter(
        (b) =>
          !b.last_login ||
          (b.days_since_last_activity && b.days_since_last_activity > 30),
      ).length;

      setStats({
        totalTeamMembers: teamMembersData?.length || 0,
        activeToday,
        activeThisWeek,
        activeThisMonth,
        inactiveTeamMembers,
      });

      setTeamMemberActivity(processedActivity);
    } catch (err) {
      console.error("Error loading analytics:", err);

      let errorMessage = "Failed to load analytics";
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case "today":
        return "Today";
      case "week":
        return "Last 7 Days";
      case "month":
        return "Last 30 Days";
    }
  };

  const formatLastActivity = (date: string | null, days: number | null) => {
    if (!date) return "Never";
    if (days === null) return "Never";

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <div className="space-y-6">
      {/* Office Filter Indicator */}
      {officeFilter && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-sm font-medium text-blue-900">
            📍 Viewing activity for: <span className="font-bold">{officeFilter} Office</span>
          </p>
        </div>
      )}
      
      {/* Header with Timeframe Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            TeamMember Usage Analytics
          </h2>
          <p className="text-sm text-slate-600">
            Track who's using the application and how often
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeframe("today")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              timeframe === "today"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeframe("week")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              timeframe === "week"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setTimeframe("month")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              timeframe === "month"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Total TeamMembers */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total TeamMembers</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {stats.totalTeamMembers}
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 p-3">
                  <Users className="h-6 w-6 text-slate-600" />
                </div>
              </div>
            </div>

            {/* Active Today */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Active Today</p>
                  <p className="mt-1 text-2xl font-semibold text-green-600">
                    {stats.activeToday}
                  </p>
                </div>
                <div className="rounded-full bg-green-100 p-3">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Active This Week */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">This Week</p>
                  <p className="mt-1 text-2xl font-semibold text-blue-600">
                    {stats.activeThisWeek}
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Active This Month */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">This Month</p>
                  <p className="mt-1 text-2xl font-semibold text-purple-600">
                    {stats.activeThisMonth}
                  </p>
                </div>
                <div className="rounded-full bg-purple-100 p-3">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Inactive TeamMembers */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Inactive (30d+)</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-600">
                    {stats.inactiveTeamMembers}
                  </p>
                </div>
                <div className="rounded-full bg-amber-100 p-3">
                  <Activity className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          {/* TeamMember Activity Table */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">
                Individual TeamMember Activity
              </h3>
              <p className="text-sm text-slate-600">
                Recent application usage by teamMember ({getTimeframeLabel()})
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                      TeamMember
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                      Office
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                      Recent Actions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                      Last Activity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamMemberActivity.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No activity data available
                      </td>
                    </tr>
                  ) : (
                    teamMemberActivity.map((teamMember) => {
                      const isActive =
                        teamMember.days_since_last_activity !== null &&
                        teamMember.days_since_last_activity < 7;
                      const isInactive =
                        teamMember.days_since_last_activity !== null &&
                        teamMember.days_since_last_activity > 30;

                      return (
                        <tr key={teamMember.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm">
                            <div>
                              <p className="font-medium text-slate-900">
                                {teamMember.first_name} {teamMember.last_name || ""}
                              </p>
                              <p className="text-xs text-slate-500">
                                {teamMember.email}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {teamMember.office_location || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {teamMember.recent_actions}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatLastActivity(
                              teamMember.last_login,
                              teamMember.days_since_last_activity,
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : isInactive
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {isActive
                                ? "Active"
                                : isInactive
                                  ? "Inactive"
                                  : "Low Activity"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
