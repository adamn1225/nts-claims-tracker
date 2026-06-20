"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CustomerRow = {
  status: string;
  next_follow_up_date: string | null;
  broker_id: string | null;
};

type BrokerRow = {
  id: string;
  office_location: string | null;
};

type CompanyAnalyticsProps = {
  officeFilter?: string | null;
};

export default function CompanyAnalytics({ officeFilter }: CompanyAnalyticsProps = {}) {
  const supabase = createClient();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      
      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("status, next_follow_up_date, broker_id");
      
      if (customersError) {
        setError(customersError.message);
        setLoading(false);
        return;
      }
      
      // Load brokers if we need to filter by office
      if (officeFilter) {
        const { data: brokersData, error: brokersError } = await supabase
          .from("brokers")
          .select("id, office_location");
        
        if (brokersError) {
          setError(brokersError.message);
          setLoading(false);
          return;
        }
        
        setBrokers(brokersData || []);
      }
      
      setRows(customersData || []);
      setLoading(false);
    };
    load();
  }, [supabase, officeFilter]);

  // Filter customers by office if officeFilter is provided
  const filteredRows = useMemo(() => {
    if (!officeFilter) return rows;
    
    // Get broker IDs for the target office
    const officeBrokerIds = new Set(
      brokers
        .filter((b) => b.office_location === officeFilter)
        .map((b) => b.id)
    );
    
    // Filter customers to only those assigned to brokers in the office
    return rows.filter((c) => c.broker_id && officeBrokerIds.has(c.broker_id));
  }, [rows, brokers, officeFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const byStatus = filteredRows.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});
    const now = new Date();
    const overdue = filteredRows.filter(
      (c) => c.next_follow_up_date && new Date(c.next_follow_up_date) < now,
    ).length;
    const upcoming = filteredRows.filter(
      (c) => c.next_follow_up_date && new Date(c.next_follow_up_date) >= now,
    ).length;
    return { total, byStatus, overdue, upcoming };
  }, [filteredRows]);

  const bar = (count: number, max: number, color: string) => (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded bg-slate-100">
        <div
          className={`h-2 rounded ${color}`}
          style={{ width: `${(count / Math.max(max, 1)) * 100}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs text-slate-600">{count}</div>
    </div>
  );

  const max = Math.max(...Object.values(stats.byStatus), 1);

  return (
    <div className="space-y-4">
      {officeFilter && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-sm font-medium text-blue-900">
            📍 Viewing analytics for: <span className="font-bold">{officeFilter} Office</span>
          </p>
        </div>
      )}
      {loading && (
        <div className="p-3 text-sm text-slate-500">Loading analytics…</div>
      )}
      {error && <div className="p-3 text-sm text-red-600">Error: {error}</div>}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-600">Total Customers</div>
          <div className="text-xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="rounded-lg bg-red-50 p-3">
          <div className="text-xs text-red-600">Overdue Follow-ups</div>
          <div className="text-xl font-bold text-red-900">{stats.overdue}</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-3">
          <div className="text-xs text-blue-600">Upcoming Follow-ups</div>
          <div className="text-xl font-bold text-blue-900">
            {stats.upcoming}
          </div>
        </div>
        <div className="rounded-lg bg-green-50 p-3">
          <div className="text-xs text-green-600">Active Pipelines</div>
          <div className="text-xl font-bold text-green-900">
            {stats.byStatus["active"] || 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          Status Breakdown
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium text-blue-700">
              Prospect
            </div>
            {bar(stats.byStatus["prospect"] || 0, max, "bg-blue-400")}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-lime-700">Active</div>
            {bar(stats.byStatus["active"] || 0, max, "bg-lime-400")}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-amber-600">Won</div>
            {bar(stats.byStatus["won"] || 0, max, "bg-amber-400")}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-700">Lost</div>
            {bar(stats.byStatus["lost"] || 0, max, "bg-slate-400")}
          </div>
        </div>
      </div>

      {!loading && !error && filteredRows.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {officeFilter 
            ? `No customers assigned to brokers in the ${officeFilter} office yet.`
            : "No customers yet. Add customers to see analytics populate."
          }
        </div>
      )}
    </div>
  );
}
