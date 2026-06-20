/**
 * Office Manager Reports Page - Office-specific Analytics
 *
 * Features:
 * - Office-level KPIs
 * - Broker breakdown for the manager's office
 * - Drill-down to individual broker weekly performance
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

type BrokerStats = {
  broker_id: string;
  broker_name: string;
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
  broker_id: string;
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
  const [brokerStats, setBrokerStats] = useState<BrokerStats[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);

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

        const { data: broker, error: fetchError } = await supabase
          .from("brokers")
          .select("is_manager, office_location")
          .eq("id", user.id)
          .single();

        if (fetchError || !broker?.is_manager) {
          router.push("/dashboard/reports");
          return;
        }

        setManagerOffice(broker.office_location);
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

        // Get broker stats for this office
        const { data: brokerData, error: brokerError } = await supabase
          .from("broker_customer_summary")
          .select("*")
          .eq("office_location", managerOffice);

        if (brokerError) throw brokerError;

        setBrokerStats(brokerData || []);

        // Calculate office-level stats
        const totalCustomers = (brokerData || []).reduce(
          (sum, b) => sum + (b.total_customers || 0),
          0,
        );
        const totalWon = (brokerData || []).reduce(
          (sum, b) => sum + (b.won_count || 0),
          0,
        );
        const totalConverted = (brokerData || []).reduce((sum, b) => {
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
          .select("id, title, broker_id, customer_id, due_date")
          .eq("status", "overdue")
          .in(
            "broker_id",
            (brokerData || []).map((b) => b.broker_id),
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

  // Filter broker stats by selected broker
  const filteredBrokerStats = useMemo(() => {
    if (!selectedBroker) return brokerStats;
    return brokerStats.filter((b) => b.broker_id === selectedBroker);
  }, [brokerStats, selectedBroker]);

  const selectedBrokerData = useMemo(() => {
    return brokerStats.find((b) => b.broker_id === selectedBroker);
  }, [brokerStats, selectedBroker]);

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

      {/* Broker Performance Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Broker Performance
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Click a broker to view detailed metrics
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Broker Name
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
              {brokerStats.map((broker) => (
                <tr
                  key={broker.broker_id}
                  onClick={() =>
                    setSelectedBroker(
                      selectedBroker === broker.broker_id
                        ? null
                        : broker.broker_id,
                    )
                  }
                  className={`cursor-pointer transition-colors ${
                    selectedBroker === broker.broker_id
                      ? "bg-orange-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {broker.broker_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {broker.total_customers}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {broker.prospect_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {broker.active_count}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">
                    {broker.won_count}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                    {broker.win_rate_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Broker Details */}
      {selectedBrokerData && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedBrokerData.broker_name} - Detailed Metrics
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                This broker's full performance breakdown
              </p>
            </div>
            <button
              onClick={() => setSelectedBroker(null)}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Close
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-slate-600">Prospect Conversion Rate</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {selectedBrokerData.prospect_count > 0
                  ? Math.round(
                      ((selectedBrokerData.active_count +
                        selectedBrokerData.won_count) /
                        (selectedBrokerData.prospect_count +
                          selectedBrokerData.active_count +
                          selectedBrokerData.won_count)) *
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
                    {selectedBrokerData.prospect_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="font-semibold">
                    {selectedBrokerData.active_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Won:</span>
                  <span className="font-semibold text-green-600">
                    {selectedBrokerData.won_count}
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
