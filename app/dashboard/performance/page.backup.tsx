/**
 * Performance Dashboard — Call Analytics & Coaching
 *
 * Access: SalesTrack admins (is_admin=true) only.
 *
 * Data source: GoTo admin token proxy — pulls ALL org agents directly from
 * GoTo's user list. Agents do NOT need SalesTrack accounts.
 *
 * View modes:
 *  - Team     : Org-wide KPIs + sortable agent leaderboard
 *  - Groups   : Per-office-location group summary cards
 *  - Individual: Single-agent call log + AI coaching breakdown
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  WifiOff,
  ExternalLink,
  RefreshCw,
  Users,
  BarChart3,
  User,
  ChevronLeft,
} from "lucide-react";

import { Filter } from "lucide-react";

import type {
  AgentSummaryRow,
  PerformanceData,
  ViewMode,
} from "@/components/performance/types";
import { KpiRow } from "@/components/performance/KpiRow";
import { TeamMemberLeaderboard } from "@/components/performance/TeamMemberLeaderboard";
import { CallDetailPanel } from "@/components/performance/CallDetailPanel";
import { CoachingSummary } from "@/components/performance/CoachingSummary";
import { GroupView } from "@/components/performance/GroupView";

const EMPTY_DATA: PerformanceData = {
  agentSummaries: [],
  callDetails: [],
  callScores: {},
  groups: [],
  dataSource: "api",
};

export default function PerformanceDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [authorized, setAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [data, setData] = useState<PerformanceData>(EMPTY_DATA);
  const [apiLoading, setApiLoading] = useState(false);
  const [hasGoToConnection, setHasGoToConnection] = useState<boolean | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("team");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [daysWindow, setDaysWindow] = useState(30);
  const [availableQueues, setAvailableQueues] = useState<string[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [reauthMessage, setReauthMessage] = useState<string | null>(null);
  const [dataSourceDetail, setDataSourceDetail] = useState<string | null>(null);

  useEffect(() => {
    const authorize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/auth/login"); return; }

        const { data: teamMember, error: teamMemberErr } = await supabase
          .from("team_members")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (teamMemberErr || !teamMember?.is_admin) { router.push("/dashboard"); return; }
        setAuthorized(true);
      } catch (err) {
        console.error("Authorization error:", err);
        setAuthError("Authorization failed. Please refresh and try again.");
      } finally {
        setAuthChecking(false);
      }
    };
    authorize();
  }, [supabase, router]);

  const fetchGoToData = useCallback(async (days: number, queues: string[] = []) => {
    setApiLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (queues.length > 0) params.set("queues", queues.join(","));
      const resp = await fetch(`/api/goto/performance?${params}`);
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson?.error ?? `HTTP ${resp.status}`);
      }
      const json = await resp.json();
      setHasGoToConnection(json.hasGoTo ?? false);
      setReauthMessage(json.reauthMessage ?? null);
      setDataSourceDetail(json.dataSourceDetail ?? null);
      if (json.availableQueues?.length > 0 && availableQueues.length === 0) {
        setAvailableQueues(json.availableQueues);
      }
      if (json.hasGoTo) {
        setData({
          agentSummaries: json.agentSummaries ?? [],
          callDetails: json.callDetails ?? [],
          callScores: {},
          groups: json.groups ?? [],
          dataSource: "api",
          importedAt: json.fetchedAt,
        });
        setSelectedAgent(null);
        setSelectedGroup(null);
      } else {
        setData(EMPTY_DATA);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Performance] fetch error:", err);
      setFetchError(msg);
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) fetchGoToData(daysWindow, selectedQueues);
  }, [authorized, daysWindow, fetchGoToData]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleAgents: AgentSummaryRow[] =
    viewMode === "groups" && selectedGroup
      ? data.agentSummaries.filter(
          (a) => (a.officeLocation?.trim() || "Unassigned") === selectedGroup,
        )
      : data.agentSummaries;

  const hasData = data.agentSummaries.length > 0;

  if (authChecking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }
  if (authError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{authError}</div>
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Call Performance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Agent analytics powered by GoTo — all org agents, no SalesTrack account required
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={daysWindow}
            onChange={(e) => { setDaysWindow(Number(e.target.value)); setSelectedAgent(null); setSelectedGroup(null); }}
            disabled={apiLoading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {/* Queue filter */}
          {availableQueues.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  const el = document.getElementById("queue-filter-panel");
                  if (el) el.classList.toggle("hidden");
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
                  selectedQueues.length > 0
                    ? "border-orange-300 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Filter className="h-4 w-4 shrink-0" />
                {selectedQueues.length > 0 ? `${selectedQueues.length} queue${selectedQueues.length > 1 ? "s" : ""}` : "All queues"}
              </button>
              <div
                id="queue-filter-panel"
                className="hidden absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter by Queue</div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
                  {availableQueues.map((q) => (
                    <label key={q} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedQueues.includes(q)}
                        onChange={(e) => {
                          setSelectedQueues(e.target.checked
                            ? [...selectedQueues, q]
                            : selectedQueues.filter((x) => x !== q));
                        }}
                        className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                      />
                      {q}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-slate-100 p-2">
                  <button
                    onClick={() => {
                      setSelectedQueues([]);
                      fetchGoToData(daysWindow, []);
                      document.getElementById("queue-filter-panel")?.classList.add("hidden");
                    }}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      fetchGoToData(daysWindow, selectedQueues);
                      document.getElementById("queue-filter-panel")?.classList.add("hidden");
                    }}
                    className="flex-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => fetchGoToData(daysWindow, selectedQueues)}
            disabled={apiLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${apiLoading ? "animate-spin" : ""}`} />
            {apiLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* No GoTo connection */}
      {hasGoToConnection === false && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
          <WifiOff className="h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">GoTo admin account not connected</p>
            <p className="mt-0.5 text-xs text-red-600">
              Connect a GoTo account with admin access to pull live call data for all agents.
            </p>
          </div>
          <a
            href="/api/goto/auth?admin=true"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Connect GoTo
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Re-auth / upgrade notice */}
      {reauthMessage && dataSourceDetail === "call-history-fallback" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Filter className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800">
            <span className="font-semibold">Queue filtering not yet active. </span>
            {reauthMessage}
          </div>
          <a
            href="/api/goto/auth?admin=true"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Re-auth
          </a>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Data fetch failed:</span> {fetchError}
        </div>
      )}

      {/* Initial load skeleton */}
      {apiLoading && !hasData && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
          <p className="text-sm text-slate-600">Fetching live call data from GoTo for all org agents…</p>
        </div>
      )}

      {/* No data in range */}
      {!apiLoading && hasGoToConnection === true && !hasData && !fetchError && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No call data found for the last {daysWindow} days</p>
          <p className="mt-1 text-xs text-slate-400">Try a wider date range or check your GoTo admin token access.</p>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mx-auto max-w-2xl text-left">
            <p className="text-xs font-medium text-amber-900 mb-1">⚠️ GoTo Contact Center Not Enabled</p>
            <p className="text-xs text-amber-700 mb-2">
              Your OAuth token <strong>has the required scopes</strong> (<code className="px-1 bg-amber-100 rounded text-amber-900">queue-caller.v1.read</code>), 
              but GoTo's Contact Center API endpoints return <strong>404 (NOT_FOUND)</strong>.
            </p>
            <p className="text-xs text-amber-700">
              <strong>Action Required:</strong> Contact your GoTo account manager to enable <strong>Contact Center Analytics</strong> features on your account backend. 
              Currently showing user-scoped call data only (authenticated user's calls).
            </p>
          </div>
        </div>
      )}

      {/* Main dashboard */}
      {hasData && (
        <>
          {/* View mode tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
            {([
              { mode: "team" as ViewMode, icon: BarChart3, label: "Team" },
              { mode: "groups" as ViewMode, icon: Users, label: "Groups" },
              { mode: "individual" as ViewMode, icon: User, label: "Individual" },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setSelectedAgent(null); setSelectedGroup(null); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-white text-orange-600 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`inline-block h-2 w-2 rounded-full ${dataSourceDetail === "queue-caller-analytics" ? "bg-green-500" : "bg-amber-400"}`} />
            <span>
              {dataSourceDetail === "queue-caller-analytics" ? "Queue analytics" : "Call history"}
              {" · "}{data.agentSummaries.length} agents · last {daysWindow} days
              {selectedQueues.length > 0 && <> · {selectedQueues.length} queue{selectedQueues.length > 1 ? "s" : ""}</>}
              {data.importedAt && <> · {new Date(data.importedAt).toLocaleTimeString()}</>}
            </span>
          </div>

          {/* ─── TEAM VIEW ─── */}
          {viewMode === "team" && (
            <div className="space-y-6">
              <KpiRow agents={data.agentSummaries} />
              <TeamMemberLeaderboard
                agents={data.agentSummaries}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
              />
              {selectedAgent && (
                <div className="grid gap-6 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <CallDetailPanel agentName={selectedAgent} calls={data.callDetails} callScores={data.callScores} />
                  </div>
                  <div className="xl:col-span-1">
                    <CoachingSummary agentName={selectedAgent} calls={data.callDetails} callScores={data.callScores} />
                  </div>
                </div>
              )}
              {!selectedAgent && (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                  <p className="text-sm text-slate-400">Select an agent from the leaderboard to view call detail and coaching insights.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── GROUPS VIEW ─── */}
          {viewMode === "groups" && (
            <div className="space-y-6">
              <GroupView
                groups={data.groups}
                selectedGroup={selectedGroup}
                onSelectGroup={(name) => { setSelectedGroup(name === selectedGroup ? null : name); setSelectedAgent(null); }}
              />
              {selectedGroup && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setSelectedGroup(null); setSelectedAgent(null); }}
                      className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      All groups
                    </button>
                    <span className="text-sm font-semibold text-slate-800">{selectedGroup}</span>
                  </div>
                  <KpiRow agents={visibleAgents} />
                  <TeamMemberLeaderboard agents={visibleAgents} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
                  {selectedAgent && (
                    <div className="grid gap-6 xl:grid-cols-3">
                      <div className="xl:col-span-2">
                        <CallDetailPanel agentName={selectedAgent} calls={data.callDetails} callScores={data.callScores} />
                      </div>
                      <div className="xl:col-span-1">
                        <CoachingSummary agentName={selectedAgent} calls={data.callDetails} callScores={data.callScores} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── INDIVIDUAL VIEW ─── */}
          {viewMode === "individual" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Select agent:</label>
                <select
                  value={selectedAgent ?? ""}
                  onChange={(e) => setSelectedAgent(e.target.value || null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">— choose an agent —</option>
                  {data.agentSummaries.map((a) => (
                    <option key={a.agentName} value={a.agentName}>
                      {a.agentName}{a.officeLocation ? ` (${a.officeLocation})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {selectedAgent ? (
                <>
                  <KpiRow agents={data.agentSummaries.filter((a) => a.agentName === selectedAgent)} />
                  <div className="grid gap-6 xl:grid-cols-3">
                    <div className="xl:col-span-2">
                      <CallDetailPanel agentName={selectedAgent} calls={data.callDetails} callScores={data.callScores} />
                    </div>
                    <div className="xl:col-span-1">
                      <CoachingSummary agentName={selectedAgent} calls={data.callDetails} callScores={data.callScores} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
                  <User className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-400">Choose an agent above to view their individual performance.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
