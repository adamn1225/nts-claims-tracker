"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Day-of-week × hour activity heatmap, derived from existing activity
 * timestamps (contact log, tasks, customer updates) over the last 90 days.
 * Helps admins pick low-traffic windows for maintenance.
 *
 * All timestamps are bucketed in the viewer's local timezone.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LOOKBACK_DAYS = 90;

// JS getDay(): 0=Sun..6=Sat -> remap so Monday is index 0
function dayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function formatHour(h: number): string {
  const period = h < 12 ? "a" : "p";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${period}`;
}

export default function ActivityHeatmap() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: 7 }, () => Array(24).fill(0)),
  );
  const [totalEvents, setTotalEvents] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const since = new Date(
        Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      try {
        const [contacts, tasks, customers] = await Promise.all([
          supabase
            .from("contact_log")
            .select("contact_date")
            .gte("contact_date", since),
          supabase.from("tasks").select("created_at").gte("created_at", since),
          supabase
            .from("customers")
            .select("updated_at")
            .gte("updated_at", since),
        ]);

        if (cancelled) return;

        const timestamps: string[] = [];
        if (contacts.data)
          for (const r of contacts.data)
            if (r.contact_date) timestamps.push(r.contact_date);
        if (tasks.data)
          for (const r of tasks.data)
            if (r.created_at) timestamps.push(r.created_at);
        if (customers.data)
          for (const r of customers.data)
            if (r.updated_at) timestamps.push(r.updated_at);

        const next = Array.from({ length: 7 }, () => Array(24).fill(0));
        for (const ts of timestamps) {
          const d = new Date(ts);
          if (Number.isNaN(d.getTime())) continue;
          next[dayIndex(d)][d.getHours()] += 1;
        }

        setGrid(next);
        setTotalEvents(timestamps.length);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load activity data",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = useMemo(
    () => Math.max(1, ...grid.flat()),
    [grid],
  );

  // Quietest 2-hour window across the full week (lowest total activity)
  const quietest = useMemo(() => {
    let best = { day: 0, hour: 0, count: Infinity };
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const total = grid[day][hour] + grid[day][(hour + 1) % 24];
        if (total < best.count) best = { day, hour, count: total };
      }
    }
    return best;
  }, [grid]);

  function cellColor(count: number): string {
    if (count === 0) return "bg-slate-100";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "bg-orange-600";
    if (ratio > 0.5) return "bg-orange-500";
    if (ratio > 0.25) return "bg-orange-400";
    if (ratio > 0.1) return "bg-orange-300";
    return "bg-orange-200";
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Activity className="h-5 w-5 text-orange-500" />
        <h3 className="text-base font-semibold text-slate-900">
          Activity Heatmap
        </h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        When users are most active over the last {LOOKBACK_DAYS} days. Darker
        cells mean more activity — pick lighter cells for maintenance windows.
        Times shown in <span className="font-medium">{tz}</span>.
      </p>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading activity…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : totalEvents === 0 ? (
        <p className="text-sm text-slate-500">
          No activity recorded in the last {LOOKBACK_DAYS} days yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Hour header */}
              <div className="flex">
                <div className="w-10 shrink-0" />
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="w-5 shrink-0 text-center text-[9px] text-slate-400"
                  >
                    {h % 3 === 0 ? formatHour(h) : ""}
                  </div>
                ))}
              </div>

              {grid.map((row, day) => (
                <div key={day} className="flex items-center">
                  <div className="w-10 shrink-0 pr-1 text-right text-[11px] font-medium text-slate-500">
                    {DAYS[day]}
                  </div>
                  {row.map((count, hour) => (
                    <div
                      key={hour}
                      title={`${DAYS[day]} ${formatHour(hour)} — ${count} ${
                        count === 1 ? "event" : "events"
                      }`}
                      className={`m-px h-5 w-5 shrink-0 rounded-sm ${cellColor(
                        count,
                      )}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Less</span>
              <span className="h-3 w-3 rounded-sm bg-slate-100" />
              <span className="h-3 w-3 rounded-sm bg-orange-200" />
              <span className="h-3 w-3 rounded-sm bg-orange-400" />
              <span className="h-3 w-3 rounded-sm bg-orange-500" />
              <span className="h-3 w-3 rounded-sm bg-orange-600" />
              <span>More</span>
            </div>
            {Number.isFinite(quietest.count) && (
              <p className="text-xs text-slate-600">
                Quietest window:{" "}
                <span className="font-semibold text-green-700">
                  {DAYS[quietest.day]} {formatHour(quietest.hour)}–
                  {formatHour((quietest.hour + 2) % 24)}
                </span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
