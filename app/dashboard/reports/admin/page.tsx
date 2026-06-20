/**
 * Admin Analytics Dashboard - Company-wide View
 *
 * Features:
 * - Company-wide KPIs (total customers, win rate, overdue tasks)
 * - Office filter to drill down to single office
 * - Office comparison view
 * - Broker-level breakdown
 * - Weekly/monthly trend filters
 *
 * Access: Admins only
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
  Filter,
  BarChart3,
} from "lucide-react";

type OfficeStats = {
  office_location: string;
  total_customers: number;
  prospect_count: number;
  active_count: number;
  won_count: number;
  lost_count: number;
  win_rate_pct: number;
};

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

export default function AdminReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [officeStats, setOfficeStats] = useState<OfficeStats[]>([]);
  const [brokerStats, setBrokerStats] = useState<BrokerStats[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [overallStats, setOverallStats] = useState({
    total_customers: 0,
    won_count: 0,
    win_rate_pct: 0,
    overdue_tasks: 0,
  });

  // Check authorization and load data
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
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (fetchError || !broker?.is_admin) {
          router.push("/dashboard/reports");
          return;
        }

        setIsAdmin(true);
      } catch (err) {
        console.error("Authorization error:", err);
        setError("Authorization failed");
      }
    };

    authorize();
  }, [supabase, router]);

  // Load analytics data
  useEffect(() => {
    if (!isAdmin) return;

    const loadAnalytics = async () => {
      try {
        setLoading(true);

        // Query office-level stats from the view
        const { data: officeData, error: officeError } = await supabase
          .from("office_customer_summary")
          .select("*");

        if (officeError) throw officeError;

        setOfficeStats(officeData || []);

        // Query broker-level stats from the view
        const { data: brokerData, error: brokerError } = await supabase
          .from("broker_customer_summary")
          .select("*");

        if (brokerError) throw brokerError;

        setBrokerStats(brokerData || []);

        // Calculate overall stats
        const totalCustomers = (officeData || []).reduce(
          (sum, o) => sum + (o.total_customers || 0),
          0,
        );
        const totalWon = (officeData || []).reduce(
          (sum, o) => sum + (o.won_count || 0),
          0,
        );
        const totalConverted = (officeData || []).reduce((sum, o) => {
          const converted =
            (o.active_count || 0) + (o.won_count || 0) + (o.lost_count || 0);
          return sum + converted;
        }, 0);
        const overallWinRate =
          totalConverted > 0
            ? Math.round((totalWon / totalConverted) * 100)
            : 0;

        // Count overdue tasks
        const { count: overdueCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("status", "overdue");

        setOverallStats({
          total_customers: totalCustomers,
          won_count: totalWon,
          win_rate_pct: overallWinRate,
          overdue_tasks: overdueCount || 0,
        });

        setError(null);
      } catch (err) {
        console.error("Failed to load analytics:", err);
        setError("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [isAdmin, supabase]);

  // Filter data by selected office
  const filteredBrokerStats = useMemo(() => {
    if (!selectedOffice) return brokerStats;
    return brokerStats.filter((b) => b.office_location === selectedOffice);
  }, [brokerStats, selectedOffice]);

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
          Analytics & Reports
        </h1>
        <p className="mt-1 text-slate-600">Company-wide performance metrics</p>
      </div>

      {/* Overall KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Customers */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Customers</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {overallStats.total_customers}
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
                {overallStats.won_count}
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
                {overallStats.win_rate_pct}%
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
                {overallStats.overdue_tasks}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Office-level Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Performance by Office
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Click an office to drill down to individual brokers
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                  Office Location
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
              {officeStats.map((office) => (
                <tr
                  key={office.office_location}
                  onClick={() =>
                    setSelectedOffice(
                      selectedOffice === office.office_location
                        ? null
                        : office.office_location,
                    )
                  }
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {office.office_location}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {office.total_customers}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {office.prospect_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {office.active_count}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">
                    {office.won_count}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                    {office.win_rate_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broker Breakdown (if office selected or all) */}
      {filteredBrokerStats.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Broker Performance
                {selectedOffice && (
                  <span className="ml-2 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
                    {selectedOffice}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Individual broker metrics
              </p>
            </div>
            {selectedOffice && (
              <button
                onClick={() => setSelectedOffice(null)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                    Broker Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                    Office
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                    Total
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
                {filteredBrokerStats.map((broker) => (
                  <tr key={broker.broker_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {broker.broker_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {broker.office_location}
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
      )}
    </div>
  );
}
