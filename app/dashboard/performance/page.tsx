/**
 * Performance Dashboard — GoTo Call Analytics
 *
 * Company-wide GoTo call performance monitoring for NTS/Heavy Haulers.
 * Covers 234 GoTo users across all office locations.
 */

"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  X,
  ChevronRight,
  FlaskConical,
  KeyRound,
  TrendingDown,
  PhoneForwarded,
  UserCheck,
  Clock,
  Voicemail,
  Play,
  Search,
  Download,
} from "lucide-react";


interface GoToUser {
  agentName: string;
  gotoUserKey: string;
  gotoUserEmail: string;
  handledCalls: number;
  totalTalkTimeSeconds: number;
  missedRingPct: number;
  sentimentPositivePct: number;
}

interface FollowupAgent {
  agentName: string;
  followups: number;
  avgResponseMinutes: number | null;
}

interface FollowupData {
  days: number;
  windowHours: number;
  totalMissedNumbers: number;
  followedUp: number;
  notFollowedUp: number;
  followupRate: number;
  byAgent: FollowupAgent[];
  agentsChecked: number;
}

interface CallDetail {
  id: string;
  agentName: string;
  queue: string;
  talkDurationSeconds: number;
  outcome: string;
  startTime: string;
  callerName: string;
  callerNumber: string;
  waitTimeSeconds?: number;
}

interface CoachingCall {
  id: string;
  teamMemberName: string;
  teamMemberEmail: string;
  gotoUserKey: string;
  startTime: string;
  duration: number;
  direction: "INBOUND" | "OUTBOUND";
  customerPhone: string;
  customerName?: string;
  score: number;
  questionsCovered: string[];
  questionsMissing: string[];
  transcript?: string;
  aiAnalysis: string;
}

interface CoachingResponse {
  analyzed: number;
  totalRecordings: number;
  skipped: number;
  avgScore: number;
  recordingApiBlocked?: boolean;
  calls: CoachingCall[];
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function scoreBadgeClass(score: number): string {
  if (score <= 1) return "bg-red-100 text-red-700";
  if (score <= 3) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function scoreLabel(score: number): string {
  if (score <= 1) return "Critical";
  if (score <= 3) return "Needs Coaching";
  return "Strong";
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold tabular-nums ${accent ? "text-[#E85D04]" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function PerformancePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<GoToUser[]>([]);
  const [callDetails, setCallDetails] = useState<CallDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nextPageMarker, setNextPageMarker] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalFetched, setTotalFetched] = useState(0);

  // Abort controller for background auto-pagination — cancelled on unmount or data refresh
  const bgFetchAbortRef = useRef<AbortController | null>(null);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [callerActivityResults, setCallerActivityResults] = useState<any>(null);
  const [callerActivityLoading, setCallerActivityLoading] = useState(false);

  // Queue filter — populated from API response, applied to all data fetches
  const [availableQueues, setAvailableQueues] = useState<string[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [queueDropdownOpen, setQueueDropdownOpen] = useState(false);

  // Global lookback window — shared across Queue, Heatmap, and Voicemail tabs
  // (Follow-up Tracker uses its own hardcoded window)
  const [globalDays, setGlobalDays] = useState(14);

  // Active tab
  const [activeTab, setActiveTab] = useState<"queue" | "coaching" | "callsearch" | "followup" | "heatmap" | "voicemail" | "agentstatus">("queue");

  // Recording coaching (lazy-loaded)
  const [coachingUserKey, setCoachingUserKey] = useState("");
  const [coachingSource, setCoachingSource] = useState<"auto" | "queue" | "all">("auto");
  const [coachingData, setCoachingData] = useState<CoachingResponse | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [selectedCoachingCallId, setSelectedCoachingCallId] = useState<string | null>(null);
  const [expandedTranscriptIds, setExpandedTranscriptIds] = useState<Set<string>>(new Set());

  // Call Search tab (lazy-loaded)
  const todayIso = new Date().toISOString().slice(0, 10);
  const fourteenAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [callSearchPhone, setCallSearchPhone] = useState("");
  const [callSearchStartDate, setCallSearchStartDate] = useState(fourteenAgoIso);
  const [callSearchEndDate, setCallSearchEndDate] = useState(todayIso);
  const [callSearchResults, setCallSearchResults] = useState<{
    id: string;
    callLegId: string;
    startTime: string;
    duration: number;
    direction: "INBOUND" | "OUTBOUND";
    caller: { name?: string; number: string };
    callee: { name?: string; number: string };
    hasTranscript: boolean;
    transcript?: string;
    transcriptionId?: string;
  }[] | null>(null);
  const [callSearchLoading, setCallSearchLoading] = useState(false);
  const [callSearchError, setCallSearchError] = useState<string | null>(null);
  const [callSearchExpanded, setCallSearchExpanded] = useState<Set<string>>(new Set());

  // Agent Status (lazy-loaded)
  const [agentStatusData, setAgentStatusData] = useState<{
    days: number;
    pagesLoaded: number;
    totalEvents: number;
    currentStatuses: { agentId: string; agentName: string; status: string; queueName: string; since: string; durationSeconds: number }[];
    timeBreakdown: { agentId: string; agentName: string; totalSeconds: number; byStatus: Record<string, number> }[];
  } | null>(null);
  const [agentStatusLoading, setAgentStatusLoading] = useState(false);
  const [agentStatusError, setAgentStatusError] = useState<string | null>(null);
  const [agentStatusScopeError, setAgentStatusScopeError] = useState(false);

  // Voicemail review (lazy-loaded)
  const [voicemailData, setVoicemailData] = useState<{ userName: string; received: string; duration: number; caller: { number: string; name?: string }; transcription?: string; heard: boolean }[] | null>(null);
  const [voicemailLoading, setVoicemailLoading] = useState(false);
  const [voicemailError, setVoicemailError] = useState<string | null>(null);

  // Drill-down state: null = overview (all queues), string = agents in that queue
  const [drillQueue, setDrillQueue] = useState<string | null>(null);

  // Heatmap queue filter — null = all queues, string = one specific queue
  const [heatmapQueue, setHeatmapQueue] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<"volume" | "missed" | "avgDuration">("missed");

  // Follow-up tracker (lazy-loaded)
  const [followupData, setFollowupData] = useState<FollowupData | null>(null);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);

  useEffect(() => {
    // Show success banner when redirected back from admin GoTo OAuth
    if (searchParams.get("goto_connected") === "true") {
      router.replace("/dashboard/performance");
    }
  }, []);

  // Abort any in-flight background pagination when the component unmounts (navigation away)
  useEffect(() => {
    return () => { bgFetchAbortRef.current?.abort(); };
  }, []);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("is_admin, is_sales_coach")
      .eq("id", user.id)
      .single();
    const hasAccess = Boolean(teamMember?.is_admin || (teamMember as { is_sales_coach?: boolean })?.is_sales_coach);
    if (!hasAccess) { router.push("/dashboard"); return; }
    fetchUsers();
  }

  async function fetchUsers(days = globalDays, queues = selectedQueues) {
    // Abort any previous background pagination before starting fresh
    bgFetchAbortRef.current?.abort();
    const controller = new AbortController();
    bgFetchAbortRef.current = controller;

    try {
      setLoading(true); setError(null);
      const params = new URLSearchParams({ days: String(days) });
      if (queues.length > 0) params.set("queues", queues.join(","));
      const response = await fetch(`/api/goto/performance?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsers(data.agentSummaries || []);
      setCallDetails(data.callDetails || []);
      setNextPageMarker(data.nextPageMarker ?? null);
      setTotalFetched(data.totalQueueCalls ?? 0);
      // Populate queue list on first successful load
      if (data.availableQueues?.length > 0 && availableQueues.length === 0) {
        setAvailableQueues(data.availableQueues);
      }
      // Auto-load remaining pages in the background so counts are accurate
      if (data.nextPageMarker && !controller.signal.aborted) {
        fetchRemainingPages(data.nextPageMarker, days, queues, controller.signal);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // navigated away — ignore
      console.error("Failed to fetch users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally { setLoading(false); }
  }

  /**
   * Automatically fetches all remaining pages of queue-caller data after the initial load.
   * Stops immediately when the AbortSignal fires (page navigation or data refresh).
   * Uses functional state updates to avoid stale-closure issues across async iterations.
   */
  async function fetchRemainingPages(initialMarker: string, days: number, queues: string[], signal: AbortSignal) {
    setLoadingMore(true);
    let marker: string | null = initialMarker;
    const MAX_AUTO_PAGES = 20; // safety cap: ~40,000 records max
    let pagesLoaded = 0;
    try {
      while (marker && pagesLoaded < MAX_AUTO_PAGES && !signal.aborted) {
        const params = new URLSearchParams({ days: String(days) });
        if (queues.length > 0) params.set("queues", queues.join(","));
        params.set("pageMarker", marker);
        const response = await fetch(`/api/goto/performance?${params.toString()}`, { signal });
        if (!response.ok) break;
        const data = await response.json();
        if (signal.aborted) break; // check again after awaiting response
        setUsers(prev => {
          const map = new Map(prev.map(u => [u.agentName, { ...u }]));
          for (const agent of (data.agentSummaries || [])) {
            const existing = map.get(agent.agentName);
            if (existing) {
              existing.handledCalls += agent.handledCalls;
              existing.totalTalkTimeSeconds += agent.totalTalkTimeSeconds ?? 0;
            } else {
              map.set(agent.agentName, agent);
            }
          }
          return Array.from(map.values()).sort((a, b) => b.handledCalls - a.handledCalls);
        });
        setCallDetails(prev => [...prev, ...(data.callDetails || [])]);
        setTotalFetched(prev => prev + (data.totalQueueCalls ?? 0));
        marker = data.nextPageMarker ?? null;
        setNextPageMarker(marker);
        pagesLoaded++;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // expected on navigation
      console.error("Failed to auto-load remaining pages:", err);
    } finally {
      if (!signal.aborted) setLoadingMore(false);
    }
  }

  async function loadMoreCalls() {
    if (!nextPageMarker || loadingMore) return;
    try {
      setLoadingMore(true);
      const params = new URLSearchParams({ days: String(globalDays) });
      if (selectedQueues.length > 0) params.set("queues", selectedQueues.join(","));
      params.set("pageMarker", nextPageMarker);
      const response = await fetch(`/api/goto/performance?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const mergedMap = new Map(users.map((u) => [u.agentName, { ...u }]));
      for (const agent of (data.agentSummaries || [])) {
        const existing = mergedMap.get(agent.agentName);
        if (existing) {
          existing.handledCalls += agent.handledCalls;
          existing.totalTalkTimeSeconds += agent.totalTalkTimeSeconds ?? 0;
        } else {
          mergedMap.set(agent.agentName, agent);
        }
      }
      setUsers(Array.from(mergedMap.values()).sort((a, b) => b.handledCalls - a.handledCalls));
      setCallDetails(prev => [...prev, ...(data.callDetails || [])]);
      setNextPageMarker(data.nextPageMarker ?? null);
      setTotalFetched((prev) => prev + (data.totalQueueCalls ?? 0));
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally { setLoadingMore(false); }
  }

  async function loadFollowupStats() {
    try {
      setFollowupLoading(true);
      setFollowupError(null);
      // NOTE: Follow-up Tracker intentionally uses its own fixed 14-day window,
      // not globalDays — re-enable when the feature supports variable ranges.
      const resp = await fetch("/api/goto/followup-stats?days=14&windowHours=24");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setFollowupData(data);
    } catch (err) {
      setFollowupError(err instanceof Error ? err.message : "Failed to load follow-up data");
    } finally {
      setFollowupLoading(false);
    }
  }

  async function loadVoicemails() {
    try {
      setVoicemailLoading(true);
      setVoicemailError(null);
      const resp = await fetch(`/api/goto/voicemail-review?days=${globalDays}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setVoicemailData(data.voicemails);
    } catch (err) {
      setVoicemailError(err instanceof Error ? err.message : "Failed to load voicemails");
    } finally {
      setVoicemailLoading(false);
    }
  }

  async function loadCoachingForUser(userKeyOverride?: string) {
    const targetUserKey = userKeyOverride ?? coachingUserKey;
    const selectedUser = users.find((userRow) => userRow.gotoUserKey === targetUserKey);

    if (!targetUserKey || !selectedUser) {
      setCoachingError("Select an agent with a valid GoTo user key to analyze recordings.");
      setCoachingData(null);
      setSelectedCoachingCallId(null);
      return;
    }

    try {
      setCoachingLoading(true);
      setCoachingError(null);

      const requestBody = JSON.stringify({
        userKey: selectedUser.gotoUserKey,
        userName: selectedUser.agentName,
        days: Math.min(globalDays, 30),
        maxCalls: 8,
        minDuration: 60,
        source: coachingSource,
      });

      // Retry once on 401 — session may be briefly invalid during inactivity-refresh rotation
      let resp = await fetch("/api/ai/analyze-call-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (resp.status === 401) {
        await new Promise((r) => setTimeout(r, 1500));
        resp = await fetch("/api/ai/analyze-call-quality", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
      }

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }

      const normalized: CoachingResponse = {
        analyzed: data.analyzed ?? 0,
        totalRecordings: data.totalRecordings ?? 0,
        skipped: data.skipped ?? 0,
        avgScore: data.avgScore ?? 0,
        recordingApiBlocked: Boolean(data.recordingApiBlocked),
        calls: Array.isArray(data.calls) ? data.calls : [],
      };

      setCoachingData(normalized);
      setSelectedCoachingCallId(normalized.calls[0]?.id ?? null);
    } catch (err) {
      setCoachingError(err instanceof Error ? err.message : "Failed to analyze call recordings");
      setCoachingData(null);
      setSelectedCoachingCallId(null);
    } finally {
      setCoachingLoading(false);
    }
  }

  async function runCallSearch() {
    setCallSearchError(null);
    setCallSearchResults(null);
    setCallSearchExpanded(new Set());

    if (!callSearchStartDate || !callSearchEndDate) {
      setCallSearchError("Choose a start date and end date.");
      return;
    }

    // Build inclusive ISO times: full day on both ends
    const startISO = new Date(`${callSearchStartDate}T00:00:00`).toISOString();
    const endISO = new Date(`${callSearchEndDate}T23:59:59`).toISOString();

    try {
      setCallSearchLoading(true);
      const resp = await fetch("/api/goto/call-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: callSearchPhone,
          startDate: startISO,
          endDate: endISO,
          includeTranscripts: true,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setCallSearchResults(Array.isArray(data.recordings) ? data.recordings : []);
    } catch (err) {
      setCallSearchError(err instanceof Error ? err.message : "Failed to search calls");
      setCallSearchResults(null);
    } finally {
      setCallSearchLoading(false);
    }
  }

  function downloadCallSearchTranscripts() {
    if (!callSearchResults || callSearchResults.length === 0) return;
    const withTranscript = callSearchResults.filter((r) => r.transcript);
    if (withTranscript.length === 0) return;

    const phoneTag = callSearchPhone ? callSearchPhone.replace(/\D/g, "") || "all" : "all";
    const header = `GoTo call transcripts\nPhone filter: ${callSearchPhone || "(none)"}\nDate range: ${callSearchStartDate} → ${callSearchEndDate}\nTotal calls: ${withTranscript.length}\n${"=".repeat(72)}\n\n`;
    const body = withTranscript.map((r) => {
      const when = new Date(r.startTime).toLocaleString();
      const dur = formatDuration(r.duration);
      const fromTo = `${r.caller.number || r.caller.name || "?"} → ${r.callee.number || r.callee.name || "?"}`;
      return `# ${when}  (${r.direction}, ${dur})\n${fromTo}\nRecording ID: ${r.id}\n\n${r.transcript}\n\n${"-".repeat(72)}\n`;
    }).join("\n");

    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `goto-transcripts-${phoneTag}-${callSearchStartDate}_to_${callSearchEndDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadAllCallSearchAudio() {
    if (!callSearchResults || callSearchResults.length === 0) return;
    // Sequential downloads with a small delay so the browser does not block multiple downloads
    for (const recording of callSearchResults) {
      const filename = `goto-${new Date(recording.startTime).toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${recording.id}.mp3`;
      const a = document.createElement("a");
      a.href = `/api/goto/recording-download?id=${encodeURIComponent(recording.id)}&filename=${encodeURIComponent(filename)}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Small gap so browsers don't drop simultaneous downloads
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  function handleDaysChange(newDays: number) {
    setGlobalDays(newDays);
    setVoicemailData(null);
    setFollowupData(null);
    setAgentStatusData(null);
    setCoachingData(null);
    setCoachingError(null);
    setSelectedCoachingCallId(null);
    fetchUsers(newDays, selectedQueues);
  }

  function handleQueueToggle(queue: string) {
    const next = selectedQueues.includes(queue)
      ? selectedQueues.filter((q) => q !== queue)
      : [...selectedQueues, queue];
    setSelectedQueues(next);
    // Clear dependent data and re-fetch with new filter
    setCallDetails([]);
    setUsers([]);
    setNextPageMarker(null);
    setTotalFetched(0);
    setVoicemailData(null);
    setFollowupData(null);
    setAgentStatusData(null);
    setCoachingData(null);
    setCoachingError(null);
    setSelectedCoachingCallId(null);
    fetchUsers(globalDays, next);
  }

  async function loadAgentStatus() {
    try {
      setAgentStatusLoading(true);
      setAgentStatusError(null);
      setAgentStatusScopeError(false);
      const cap = Math.min(globalDays, 14);
      const resp = await fetch(`/api/goto/agent-status?days=${cap}`);
      const data = await resp.json();
      if (!resp.ok) {
        if (data.scopeError || resp.status === 403 || resp.status === 502) setAgentStatusScopeError(true);
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setAgentStatusData(data);
    } catch (err) {
      setAgentStatusError(err instanceof Error ? err.message : "Failed to load agent status");
    } finally {
      setAgentStatusLoading(false);
    }
  }

  async function runContactCenterTest() {
    try {
      setTestLoading(true); setTestModalOpen(true); setTestResults(null);
      const response = await fetch("/api/goto/test-contact-center");
      const data = await response.json();
      setTestResults(data);
    } catch (err) { console.error("Test failed:", err); setTestResults({ error: String(err) }); }
    finally { setTestLoading(false); }
  }

  async function runCallerActivityTest() {
    try {
      setCallerActivityLoading(true);
      setTestModalOpen(true);
      setCallerActivityResults(null);
      const response = await fetch("/api/goto/test-caller-activity");
      const data = await response.json();
      setCallerActivityResults(data);
    } catch (err) {
      setCallerActivityResults({ error: String(err) });
    } finally {
      setCallerActivityLoading(false);
    }
  }



  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
          <p className="text-sm text-slate-500">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <p className="mb-1 font-semibold text-slate-800">Failed to load data</p>
          <p className="mb-4 text-sm text-slate-500">{error}</p>
          <button onClick={() => fetchUsers()} className="inline-flex items-center gap-2 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white hover:bg-[#D44E00] transition-colors">
            <RefreshCw className="h-4 w-4" />Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Call Quality Dashboard</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>{users.filter(u => u.handledCalls > 0).length} active agents</span>
              <span className="text-slate-300">·</span>
              <span>{totalFetched.toLocaleString()} queue calls — last {globalDays} days{selectedQueues.length > 0 ? ` · ${selectedQueues.length} queue${selectedQueues.length !== 1 ? "s" : ""}` : ""}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Global days filter — controls Queue, Heatmap, and Voicemail tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              {([7, 14, 30, 60] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDaysChange(d)}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${globalDays === d
                    ? "bg-[#E85D04] text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Queue filter — only shown once queue list is available */}
            {availableQueues.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setQueueDropdownOpen((o) => !o)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${selectedQueues.length > 0
                    ? "border-[#E85D04] bg-orange-50 text-[#E85D04]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                  {selectedQueues.length === 0
                    ? "All Queues"
                    : selectedQueues.length === 1
                      ? selectedQueues[0].length > 22 ? selectedQueues[0].slice(0, 22) + "…" : selectedQueues[0]
                      : `${selectedQueues.length} queues`
                  }
                </button>
                {queueDropdownOpen && (
                  <>
                    {/* Backdrop to close on outside click */}
                    <div className="fixed inset-0 z-10" onClick={() => setQueueDropdownOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filter by Queue</span>
                        {selectedQueues.length > 0 && (
                          <button
                            onClick={() => { setSelectedQueues([]); setQueueDropdownOpen(false); setCallDetails([]); setUsers([]); setNextPageMarker(null); setTotalFetched(0); fetchUsers(globalDays, []); }}
                            className="text-xs font-medium text-[#E85D04] hover:underline"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto py-1">
                        {availableQueues.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleQueueToggle(q)}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                          >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${selectedQueues.includes(q)
                              ? "border-[#E85D04] bg-[#E85D04]"
                              : "border-slate-300 bg-white"
                              }`}>
                              {selectedQueues.includes(q) && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </span>
                            <span className="truncate text-slate-700">{q}</span>
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
                        {selectedQueues.length === 0 ? "Showing all queues" : `${selectedQueues.length} of ${availableQueues.length} selected`}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button onClick={() => fetchUsers()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </button>
            <button onClick={runContactCenterTest} disabled={testLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4 text-purple-500" />}
              Test API
            </button>
            <a href="/api/goto/auth?admin=true" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <KeyRound className="h-4 w-4 text-amber-500" />Re-authenticate GoTo
            </a>
            <button
              onClick={async () => {
                // Delete the admin token row specifically (not the personal token)
                await fetch("/api/goto/disconnect-admin", { method: "DELETE" });
                window.location.href = "/api/goto/auth?admin=true";
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              title="Delete stored admin token and re-authorize from scratch"
            >
              <KeyRound className="h-4 w-4" />Force Reconnect
            </button>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-6">
          <nav className="-mb-px flex gap-1">
            {([
              { id: "queue", label: "Queue Overview" },
              { id: "coaching", label: "Coaching" },
              { id: "callsearch", label: "Call Search" },
              { id: "heatmap", label: "Activity Heatmap" },
              { id: "agentstatus", label: "Agent Status" },
              { id: "followup", label: "Follow-up Tracker (still in progress)" },
              { id: "voicemail", label: "Voicemail Review (still in progress)" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "queue") setDrillQueue(null);
                }}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? "border-[#E85D04] text-[#E85D04]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-6 space-y-5">

        {activeTab === "queue" && (<>

          {/* Breadcrumb — visible when drilled into a specific queue */}
          {drillQueue && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setDrillQueue(null)}
                className="flex items-center gap-1.5 font-medium text-[#E85D04] hover:underline"
              >
                ← All Queues
              </button>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">{drillQueue}</span>
            </div>
          )}

          {(() => {
            // Filter calls to current drill level
            const viewCalls = drillQueue
              ? callDetails.filter(c => c.queue === drillQueue)
              : callDetails;

            // Compute overview stats for the current view
            const answered = viewCalls.filter(c => c.talkDurationSeconds > 0);
            const missed = viewCalls.filter(c => c.talkDurationSeconds === 0);
            const totalTalk = answered.reduce((s, c) => s + c.talkDurationSeconds, 0);
            const avgTalk = answered.length > 0 ? Math.round(totalTalk / answered.length) : 0;
            const waitCalls = viewCalls.filter(c => (c.waitTimeSeconds ?? 0) > 0);
            const avgWait = waitCalls.length > 0
              ? Math.round(waitCalls.reduce((s, c) => s + (c.waitTimeSeconds ?? 0), 0) / waitCalls.length)
              : 0;
            const missedPct = viewCalls.length > 0 ? (missed.length / viewCalls.length) * 100 : 0;

            // Group by queue (overview) or agent (queue detail)
            const groupMap = new Map<string, typeof viewCalls>();
            for (const call of viewCalls) {
              const key = drillQueue
                ? (call.agentName || "(Unassigned)")
                : (call.queue || "Unknown Queue");
              const arr = groupMap.get(key) ?? [];
              arr.push(call);
              groupMap.set(key, arr);
            }

            const breakdown = [...groupMap.entries()].map(([key, calls]) => {
              const ans = calls.filter(c => c.talkDurationSeconds > 0);
              const miss = calls.filter(c => c.talkDurationSeconds === 0);
              const tt = ans.reduce((s, c) => s + c.talkDurationSeconds, 0);
              return {
                key,
                total: calls.length,
                answered: ans.length,
                missed: miss.length,
                missedPct: calls.length > 0 ? (miss.length / calls.length) * 100 : 0,
                avgTalkSeconds: ans.length > 0 ? Math.round(tt / ans.length) : 0,
              };
            }).sort((a, b) => {
              if (activeMetric === "volume") return b.total - a.total;
              if (activeMetric === "missed") return b.missedPct - a.missedPct;
              // avgDuration: shortest first (most concern), push zeros to bottom
              if (activeMetric === "avgDuration") {
                if (a.avgTalkSeconds === 0 && b.avgTalkSeconds === 0) return 0;
                if (a.avgTalkSeconds === 0) return 1;
                if (b.avgTalkSeconds === 0) return -1;
                return a.avgTalkSeconds - b.avgTalkSeconds;
              }
              return 0;
            });

            function cardClass(metric: typeof activeMetric) {
              return `rounded-xl border p-5 shadow-sm cursor-pointer select-none transition-all ${activeMetric === metric
                ? "border-[#E85D04] bg-orange-50 ring-1 ring-[#E85D04]"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                }`;
            }

            return (
              <>
                {/* Stat cards — click any of the first 3 to change the sort metric on the table below */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className={cardClass("volume")} onClick={() => setActiveMetric("volume")}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Total Calls{activeMetric === "volume" && <span className="ml-1 text-[#E85D04]">▼</span>}
                    </p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-slate-900">
                      {viewCalls.length.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Last {globalDays} days · click to sort</p>
                  </div>

                  <div className={cardClass("missed")} onClick={() => setActiveMetric("missed")}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Missed Rate{activeMetric === "missed" && <span className="ml-1 text-[#E85D04]">▼</span>}
                    </p>
                    <p className={`mt-1.5 text-3xl font-bold tabular-nums ${missedPct >= 25 ? "text-red-500" : missedPct >= 15 ? "text-amber-500" : "text-slate-900"
                      }`}>
                      {missedPct.toFixed(0)}%
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{missed.length.toLocaleString()} of {viewCalls.length.toLocaleString()} · click to sort</p>
                  </div>

                  <div className={cardClass("avgDuration")} onClick={() => setActiveMetric("avgDuration")}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Avg Talk Time{activeMetric === "avgDuration" && <span className="ml-1 text-[#E85D04]">▲</span>}
                    </p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-slate-900">
                      {avgTalk > 0 ? formatDuration(avgTalk) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Answered calls · click to sort</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Avg Wait Time</p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-slate-900">
                      {avgWait > 0 ? formatDuration(avgWait) : "—"}
                    </p>
                    <p className="mt-1 text-xs">
                      {nextPageMarker ? (
                        <button
                          onClick={loadMoreCalls}
                          disabled={loadingMore}
                          className="text-amber-600 hover:underline disabled:opacity-50"
                        >
                          {loadingMore ? "Loading..." : "Load more data for accuracy"}
                        </button>
                      ) : (
                        <span className="text-slate-400">All data loaded</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Breakdown table — queues (overview) or agents (queue detail) */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        {drillQueue ? `Agents in "${drillQueue}"` : "Performance by Queue"}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {drillQueue
                          ? "Sorted by selected metric — agents who handled calls in this queue"
                          : "Sorted by selected metric — click any row to see its agents"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(["volume", "missed", "avgDuration"] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setActiveMetric(m)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${activeMetric === m
                            ? "bg-[#E85D04] text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                        >
                          {m === "volume" ? "Volume" : m === "missed" ? "Missed %" : "Avg Talk"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {drillQueue ? "Agent" : "Queue"}
                          </th>
                          <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider ${activeMetric === "volume" ? "text-[#E85D04]" : "text-slate-400"
                            }`}>Total</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Answered</th>
                          <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider ${activeMetric === "missed" ? "text-[#E85D04]" : "text-slate-400"
                            }`}>Missed %</th>
                          <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider ${activeMetric === "avgDuration" ? "text-[#E85D04]" : "text-slate-400"
                            }`}>Avg Talk</th>
                          {!drillQueue && <th className="w-10 px-3 py-3"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {breakdown.map((row, index) => (
                          <tr
                            key={row.key}
                            onClick={!drillQueue ? () => setDrillQueue(row.key) : undefined}
                            className={`border-b border-slate-50 transition-colors ${!drillQueue ? "cursor-pointer hover:bg-orange-50" : "hover:bg-slate-50"
                              }`}
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${index < 3 && activeMetric !== "avgDuration"
                                  ? "bg-amber-100 text-amber-700"
                                  : index < 3
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-100 text-slate-400"
                                  }`}>{index + 1}</span>
                                <span className="text-sm font-medium text-slate-900">{row.key}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-700">
                              {row.total.toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-500">
                              {row.answered.toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 overflow-hidden rounded-full bg-slate-100 h-1.5">
                                  <div
                                    className={`h-full rounded-full ${row.missedPct >= 30 ? "bg-red-500" :
                                      row.missedPct >= 15 ? "bg-amber-400" : "bg-emerald-500"
                                      }`}
                                    style={{ width: `${Math.min(100, row.missedPct)}%` }}
                                  />
                                </div>
                                <span className={`w-10 text-right text-sm font-semibold tabular-nums ${row.missedPct >= 30 ? "text-red-600" :
                                  row.missedPct >= 15 ? "text-amber-600" : "text-emerald-600"
                                  }`}>
                                  {row.missedPct.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={`text-sm font-semibold tabular-nums ${row.avgTalkSeconds === 0 ? "text-slate-300" :
                                  row.avgTalkSeconds < 60 ? "text-red-500" :
                                    row.avgTalkSeconds >= 180 ? "text-emerald-600" : "text-amber-500"
                                  }`}>
                                  {row.avgTalkSeconds > 0 ? formatDuration(row.avgTalkSeconds) : "—"}
                                </span>
                                {drillQueue && row.avgTalkSeconds > 0 && row.avgTalkSeconds < 60 && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                    <TrendingDown className="h-2.5 w-2.5" />Coach
                                  </span>
                                )}
                              </div>
                            </td>
                            {!drillQueue && (
                              <td className="px-3 py-3.5 text-slate-300">
                                <ChevronRight className="h-4 w-4" />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {breakdown.length === 0 && (
                      <div className="py-16 text-center text-sm text-slate-400">No call data available</div>
                    )}
                  </div>

                  {breakdown.length > 0 && (
                    <div className="flex flex-wrap items-center gap-5 border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>Missed &lt; 15%</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-amber-400"></span>Missed 15–30%</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>Missed &gt; 30%</span>
                      <span className="ml-auto">{breakdown.length} {drillQueue ? "agents" : "queues"}</span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

        </>)}

        {activeTab === "coaching" && (() => {
          const coachingUsers = users
            .filter((userRow) => Boolean(userRow.gotoUserKey))
            .sort((a, b) => a.agentName.localeCompare(b.agentName));

          const selectedCoachingUser = coachingUsers.find((userRow) => userRow.gotoUserKey === coachingUserKey) ?? null;
          const selectedCoachingCall = coachingData?.calls.find((call) => call.id === selectedCoachingCallId) ?? coachingData?.calls[0] ?? null;
          const criticalCalls = coachingData?.calls.filter((call) => call.score <= 1).length ?? 0;
          const needsCoachingCalls = coachingData?.calls.filter((call) => call.score <= 3).length ?? 0;

          return (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                      <h2 className="font-semibold text-slate-900">Coaching Review</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Review analyzed recordings and transcripts for one agent at a time. Uses the GoTo recording API and AI coaching rubric.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={coachingUserKey}
                      onChange={(e) => {
                        setCoachingUserKey(e.target.value);
                        setCoachingData(null);
                        setCoachingError(null);
                        setSelectedCoachingCallId(null);
                      }}
                      className="min-w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#E85D04]"
                    >
                      <option value="">Select an agent…</option>
                      {coachingUsers.map((userRow) => (
                        <option key={userRow.gotoUserKey} value={userRow.gotoUserKey}>
                          {userRow.agentName}
                        </option>
                      ))}
                    </select>

                    <select
                      value={coachingSource}
                      onChange={(e) => {
                        setCoachingSource(e.target.value as "auto" | "queue" | "all");
                        setCoachingData(null);
                        setCoachingError(null);
                        setSelectedCoachingCallId(null);
                      }}
                      title="Source: which GoTo endpoint to pull calls from"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#E85D04]"
                    >
                      <option value="auto">Source: Auto</option>
                      <option value="queue">Queue calls only</option>
                      <option value="all">All calls (direct + outbound)</option>
                    </select>

                    <button
                      onClick={() => loadCoachingForUser()}
                      disabled={coachingLoading || !coachingUserKey}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      {coachingLoading
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</>
                        : coachingData
                          ? <><RefreshCw className="h-4 w-4" />Refresh Review</>
                          : <><Play className="h-4 w-4" />Analyze Recordings</>
                      }
                    </button>
                  </div>
                </div>

                <div className="px-6 py-3 text-xs text-slate-500">
                  Reviews up to 8 calls with transcripts from the last {Math.min(globalDays, 30)} days. Calls under 60 seconds are skipped.
                </div>
              </div>

              {coachingError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                  <p className="text-sm font-semibold text-red-700">Failed to load coaching review</p>
                  <p className="mt-1 text-xs text-red-600">{coachingError}</p>
                </div>
              )}

              {!coachingUserKey && !coachingData && !coachingLoading && !coachingError && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
                  <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-sm font-medium text-slate-500">Select an agent to start a coaching review</p>
                  <p className="mt-1 text-xs text-slate-400">This loads analyzed recordings and transcript-backed coaching notes on demand.</p>
                </div>
              )}

              {coachingUserKey && !selectedCoachingUser && !coachingLoading && !coachingError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-semibold text-amber-800">No valid GoTo key for that agent</p>
                  <p className="mt-1 text-xs text-amber-700">Refresh the dashboard data and try again. The performance feed needs a stable GoTo user match before recordings can be analyzed.</p>
                </div>
              )}

              {coachingLoading && (
                <div className="rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
                    <p className="text-sm text-slate-600">Analyzing recordings for {selectedCoachingUser?.agentName ?? "selected agent"}…</p>
                    <p className="text-xs text-slate-400">GoTo recording fetch + transcript enrichment + AI scoring can take several seconds.</p>
                  </div>
                </div>
              )}

              {coachingData && !coachingLoading && (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard label="Analyzed Calls" value={coachingData.analyzed} sub={selectedCoachingUser ? selectedCoachingUser.agentName : undefined} accent />
                    <StatCard label="Average Score" value={`${coachingData.avgScore}/5`} sub="Qualifying-question coverage" />
                    <StatCard label="Critical Calls" value={criticalCalls} sub="Score 0–1" />
                    <StatCard label="Skipped" value={coachingData.skipped} sub={`${coachingData.totalRecordings} recordings found`} />
                  </div>

                  {coachingData.calls.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
                      <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                      {coachingData.recordingApiBlocked ? (
                        <>
                          <p className="text-sm font-medium text-slate-600">GoTo Recording API access required</p>
                          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                            This feature requires beta access to the GoTo Recording API. Email{" "}
                            <a href="mailto:developer-support@goto.com" className="text-[#E85D04] hover:underline">developer-support@goto.com</a>{" "}
                            to request access for your account.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-500">No analyzed recordings in this window</p>
                          <p className="mt-1 text-xs text-slate-400">This usually means no recent recordings with transcripts matched the current filters.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-[420px,minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">Prioritized Calls</h3>
                              <p className="mt-0.5 text-xs text-slate-500">Worst-first ordering. {needsCoachingCalls} call{needsCoachingCalls !== 1 ? "s" : ""} need coaching attention.</p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{needsCoachingCalls} flagged</span>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {coachingData.calls.map((call) => {
                            const active = selectedCoachingCall?.id === call.id;
                            const transcriptExpanded = expandedTranscriptIds.has(call.id);
                            return (
                              <div key={call.id} className={active ? "bg-orange-50" : ""}>
                                <button
                                  onClick={() => setSelectedCoachingCallId(call.id)}
                                  className={`block w-full px-5 py-4 text-left transition-colors ${active ? "" : "hover:bg-slate-50"}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${scoreBadgeClass(call.score)}`}>
                                          {scoreLabel(call.score)}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{call.direction}</span>
                                      </div>
                                      <p className="mt-2 truncate text-sm font-semibold text-slate-900">{call.customerName || call.customerPhone || "Unknown caller"}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {new Date(call.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        {" · "}{new Date(call.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                        {" · "}{formatDuration(call.duration)}
                                      </p>
                                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{call.aiAnalysis}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold tabular-nums text-slate-900">{call.score}/5</p>
                                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Coverage</p>
                                    </div>
                                  </div>
                                </button>
                                {call.transcript && (
                                  <div className="px-5 pb-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedTranscriptIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(call.id)) next.delete(call.id); else next.add(call.id);
                                          return next;
                                        });
                                      }}
                                      className="text-[11px] font-semibold uppercase tracking-widest text-[#E85D04] hover:underline"
                                    >
                                      {transcriptExpanded ? "Hide transcript" : "Show transcript"}
                                    </button>
                                    {transcriptExpanded && (
                                      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{call.transcript}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        {selectedCoachingCall ? (
                          <>
                            <div className="border-b border-slate-100 px-6 py-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-slate-900">{selectedCoachingCall.customerName || selectedCoachingCall.customerPhone || "Unknown caller"}</h3>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${scoreBadgeClass(selectedCoachingCall.score)}`}>
                                      {scoreLabel(selectedCoachingCall.score)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {selectedCoachingCall.direction}{" · "}
                                    {new Date(selectedCoachingCall.startTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                    {" · "}{formatDuration(selectedCoachingCall.duration)}
                                  </p>
                                </div>
                                <div className="text-left sm:text-right">
                                  <p className="text-2xl font-bold tabular-nums text-slate-900">{selectedCoachingCall.score}/5</p>
                                  <p className="text-xs text-slate-400">Qualifying coverage</p>
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr),320px]">
                              <div className="space-y-5">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">AI Coaching Notes</p>
                                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{selectedCoachingCall.aiAnalysis}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Transcript</p>
                                  {selectedCoachingCall.transcript ? (
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selectedCoachingCall.transcript}</p>
                                  ) : (
                                    <p className="mt-3 text-sm italic text-slate-400">Transcript unavailable for this recording.</p>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-500">Questions Covered</p>
                                  {selectedCoachingCall.questionsCovered.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {selectedCoachingCall.questionsCovered.map((question) => (
                                        <span key={question} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm">
                                          {question}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-emerald-700">No qualifying topics clearly covered.</p>
                                  )}
                                </div>

                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500">Questions Missing</p>
                                  {selectedCoachingCall.questionsMissing.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {selectedCoachingCall.questionsMissing.map((question) => (
                                        <span key={question} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm">
                                          {question}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-amber-700">No major misses detected in the current rubric.</p>
                                  )}
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-xs text-slate-500">
                                  <p className="font-semibold uppercase tracking-widest text-slate-400">Review Context</p>
                                  <p className="mt-2">Agent: <span className="font-medium text-slate-700">{selectedCoachingUser?.agentName ?? selectedCoachingCall.teamMemberName}</span></p>
                                  <p className="mt-1">Phone: <span className="font-medium text-slate-700">{selectedCoachingCall.customerPhone || "Unknown"}</span></p>
                                  <p className="mt-1">Calls analyzed in run: <span className="font-medium text-slate-700">{coachingData.analyzed}</span></p>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex min-h-105 items-center justify-center px-6 py-12 text-center">
                            <div>
                              <Play className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                              <p className="text-sm font-medium text-slate-500">Select a call to review transcript and coaching notes</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {activeTab === "callsearch" && (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-[#E85D04]" />
                  <div>
                    <h2 className="font-semibold text-slate-900">Call Search</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Find recordings & transcripts by participant phone number — across all org users, no need to visit the GoTo Call Reports UI.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-6 py-5 md:grid-cols-[1fr,160px,160px,auto]">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Phone number</label>
                  <input
                    type="tel"
                    value={callSearchPhone}
                    onChange={(e) => setCallSearchPhone(e.target.value)}
                    placeholder="(555) 123-4567 or 5551234567"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D04]"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Any format works; leave blank to search by date range only.</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">From</label>
                  <input
                    type="date"
                    value={callSearchStartDate}
                    onChange={(e) => setCallSearchStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D04]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">To</label>
                  <input
                    type="date"
                    value={callSearchEndDate}
                    onChange={(e) => setCallSearchEndDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D04]"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => runCallSearch()}
                    disabled={callSearchLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors md:w-auto"
                  >
                    {callSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {callSearchLoading ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                Date range can span up to 90 days. Returns up to 200 recordings. Transcripts load automatically when available.
              </div>
            </div>

            {callSearchError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                <p className="text-sm font-semibold text-red-700">Search failed</p>
                <p className="mt-1 text-xs text-red-600">{callSearchError}</p>
              </div>
            )}

            {callSearchLoading && !callSearchResults && (
              <div className="rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
                  <p className="text-sm text-slate-600">Searching GoTo recordings…</p>
                </div>
              </div>
            )}

            {callSearchResults && callSearchResults.length === 0 && !callSearchLoading && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
                <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">No recordings matched that search</p>
                <p className="mt-1 text-xs text-slate-400">Try a wider date range or check the phone number format.</p>
              </div>
            )}

            {callSearchResults && callSearchResults.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {callSearchResults.length} recording{callSearchResults.length !== 1 ? "s" : ""} found
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {callSearchResults.filter((r) => r.transcript).length} with transcripts available.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadCallSearchTranscripts()}
                      disabled={callSearchResults.filter((r) => r.transcript).length === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download all transcripts (.txt)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadAllCallSearchAudio()}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E85D04] bg-orange-50 px-3 py-2 text-xs font-medium text-[#E85D04] hover:bg-orange-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download all audio
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {callSearchResults.map((rec) => {
                    const expanded = callSearchExpanded.has(rec.id);
                    const when = new Date(rec.startTime);
                    const filename = `goto-${when.toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${rec.id}.mp3`;
                    return (
                      <div key={rec.id} className="px-6 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                {rec.direction}
                              </span>
                              <span className="text-xs text-slate-500">
                                {when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {" · "}
                                {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                {" · "}
                                {formatDuration(rec.duration)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {rec.caller.name || rec.caller.number || "Unknown"}
                              <span className="px-1.5 text-slate-400">→</span>
                              {rec.callee.name || rec.callee.number || "Unknown"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {rec.caller.number} {rec.callee.number ? `→ ${rec.callee.number}` : ""}
                            </p>
                            {rec.transcript && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCallSearchExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(rec.id)) next.delete(rec.id); else next.add(rec.id);
                                    return next;
                                  });
                                }}
                                className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-[#E85D04] hover:underline"
                              >
                                {expanded ? "Hide transcript" : "Show transcript"}
                              </button>
                            )}
                            {expanded && rec.transcript && (
                              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{rec.transcript}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <a
                              href={`/api/goto/recording-download?id=${encodeURIComponent(rec.id)}&filename=${encodeURIComponent(filename)}`}
                              download={filename}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Audio
                            </a>
                            {rec.transcript && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(rec.transcript ?? "");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                title="Copy transcript to clipboard"
                              >
                                Copy text
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "followup" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <PhoneForwarded className="h-5 w-5 text-blue-500" />
                <div>
                  <h2 className="font-semibold text-slate-900">Follow-up Tracker</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Did your agents call back missed callers within 24 hours?
                    Checks outbound call history for all active GoTo users.
                  </p>
                </div>
              </div>
              <button
                onClick={loadFollowupStats}
                disabled={followupLoading}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {followupLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing (~15s)…</>
                  : followupData
                    ? <><RefreshCw className="h-4 w-4" />Refresh</>
                    : <><PhoneForwarded className="h-4 w-4" />Load Follow-up Data</>
                }
              </button>
            </div>

            {followupError && (
              <div className="px-6 py-4">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700">Failed to load follow-up data</p>
                  <p className="mt-0.5 text-xs text-red-600">{followupError}</p>
                </div>
              </div>
            )}

            {!followupData && !followupLoading && !followupError && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <PhoneForwarded className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-400">Click &ldquo;Load Follow-up Data&rdquo; to analyze</p>
                <p className="mt-1 text-xs text-slate-400">
                  Fetches 14 days of queue call data — typically takes 10–20 seconds
                </p>
              </div>
            )}

            {followupLoading && (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-slate-500">Analyzing 14 days of queue call data…</p>
                <p className="text-xs text-slate-400">Usually 10–20 seconds</p>
              </div>
            )}

            {followupData && !followupLoading && (
              <div className="divide-y divide-slate-100">
                {/* Summary stat cards */}
                <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Missed Numbers</p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-slate-900">
                      {followupData.totalMissedNumbers.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Unique callers not answered</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Called Back</p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-emerald-600">
                      {followupData.followedUp.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Within 24h of being missed</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Follow-up Rate</p>
                    <p className={`mt-1.5 text-3xl font-bold tabular-nums ${followupData.followupRate >= 60 ? "text-emerald-600" :
                      followupData.followupRate >= 30 ? "text-amber-500" : "text-red-500"
                      }`}>
                      {followupData.followupRate}%
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${followupData.followupRate >= 60 ? "bg-emerald-500" :
                          followupData.followupRate >= 30 ? "bg-amber-400" : "bg-red-500"
                          }`}
                        style={{ width: `${followupData.followupRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">No Follow-up</p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-red-500">
                      {followupData.notFollowedUp.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Lost opportunities</p>
                  </div>
                </div>

                {/* Per-agent leaderboard */}
                {followupData.byAgent.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2.5 px-6 py-4">
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                      <h3 className="font-semibold text-slate-800 text-sm">Who followed up most?</h3>
                      <span className="ml-auto text-xs text-slate-400">
                        {followupData.agentsChecked} agents checked · last {followupData.days} days
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-y border-slate-100 bg-slate-50">
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Rank</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Agent</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Callbacks Made</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                              <span className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />Avg Response
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {followupData.byAgent.map((agent, index) => (
                            <tr key={agent.agentName} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${index === 0 ? "bg-amber-400 text-white" :
                                  index === 1 ? "bg-slate-300 text-white" :
                                    index === 2 ? "bg-amber-700 text-white" :
                                      "bg-slate-100 text-slate-500"
                                  }`}>
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{agent.agentName}</td>
                              <td className="px-5 py-3.5 text-right">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  <PhoneForwarded className="h-3 w-3" />{agent.followups}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right text-sm text-slate-500">
                                {agent.avgResponseMinutes !== null
                                  ? agent.avgResponseMinutes < 60
                                    ? `${agent.avgResponseMinutes}m`
                                    : `${Math.floor(agent.avgResponseMinutes / 60)}h ${agent.avgResponseMinutes % 60}m`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {followupData.byAgent.length === 0 && (
                  <div className="px-6 py-8 text-center text-sm text-slate-400">
                    No outbound follow-up calls detected within {followupData.windowHours}h of missed calls
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "heatmap" && (() => {
          // Build 7×24 grid from callDetails startTime
          const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const heatmapQueues = Array.from(new Set(callDetails.map((c) => c.queue).filter(Boolean))).sort();
          const visibleCalls = heatmapQueue ? callDetails.filter((c) => c.queue === heatmapQueue) : callDetails;
          const grid: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0));
          for (const call of visibleCalls) {
            const d = new Date(call.startTime);
            grid[d.getHours()][d.getDay()]++;
          }
          const maxVal = Math.max(1, ...grid.flat());

          // Warn if there are still unloaded pages (heatmap would be incomplete)
          const hasMorePages = nextPageMarker !== null;

          function heatColor(count: number): string {
            const pct = count / maxVal;
            if (pct === 0) return "bg-slate-100 text-slate-300";
            if (pct < 0.2) return "bg-orange-100 text-orange-500";
            if (pct < 0.4) return "bg-orange-200 text-orange-600";
            if (pct < 0.6) return "bg-orange-300 text-orange-700";
            if (pct < 0.8) return "bg-orange-400 text-white";
            return "bg-[#E85D04] text-white";
          }

          const peakHour = grid.findIndex(row => row.reduce((a, b) => a + b, 0) === Math.max(...grid.map(r => r.reduce((a, b) => a + b, 0))));
          const peakDay = DAYS[grid.reduce((bestDay, _, h) => {
            const dayTotals = Array(7).fill(0).map((_, d) => grid[h][d]);
            const colTotals = Array(7).fill(0).map((_, d) => grid.reduce((s, row) => s + row[d], 0));
            const max = Math.max(...colTotals);
            return colTotals[bestDay] >= max ? bestDay : colTotals.indexOf(max);
          }, 0)];

          return (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Activity Heatmap</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Call volume by hour-of-day and day-of-week &mdash;{heatmapQueue ? ` ${visibleCalls.length.toLocaleString()} calls in "${heatmapQueue}"` : ` ${callDetails.length.toLocaleString()} calls across all queues`}, last {globalDays} days
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Per-queue filter */}
                  {heatmapQueues.length > 1 && (
                    <select
                      value={heatmapQueue ?? ""}
                      onChange={(e) => setHeatmapQueue(e.target.value || null)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-1"
                    >
                      <option value="">All Queues</option>
                      {heatmapQueues.map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-slate-100 border border-slate-200"></span>None</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-orange-200"></span>Low</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-orange-400"></span>High</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-[#E85D04]"></span>Peak</span>
                  </div>
                </div>
              </div>

              {hasMorePages && (
                <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-6 py-2.5">
                  <p className="text-xs text-amber-700">
                    Showing partial data — only the first 2,000 call records are loaded. Click <strong>Load More Now</strong> to fetch additional records and fill in the heatmap.
                  </p>
                  <button
                    onClick={() => { setActiveTab("queue"); loadMoreCalls(); }}
                    disabled={loadingMore}
                    className="ml-4 shrink-0 rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                  >
                    {loadingMore ? "Loading…" : "Load More Now"}
                  </button>
                </div>
              )}

              <div className="overflow-x-auto p-6">
                <table className="w-full border-separate border-spacing-0.5">
                  <thead>
                    <tr>
                      <th className="w-14 pr-3 text-right text-xs font-medium text-slate-400"></th>
                      {DAYS.map(d => (
                        <th key={d} className="px-1 pb-2 text-center text-xs font-semibold text-slate-500">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, hour) => {
                      const hourLabel = hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
                      const rowTotal = row.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={hour}>
                          <td className="pr-3 text-right text-[11px] text-slate-400 leading-none py-0.5">{hourLabel}</td>
                          {row.map((count, day) => (
                            <td key={day} className="p-0">
                              <div
                                className={`flex h-7 w-full min-w-8 items-center justify-center rounded text-[10px] font-semibold transition-opacity hover:opacity-80 ${heatColor(count)}`}
                                title={`${DAYS[day]} ${hourLabel}: ${count} calls`}
                              >
                                {count > 0 ? count : ""}
                              </div>
                            </td>
                          ))}
                          <td className="pl-2 text-[11px] text-slate-400">{rowTotal > 0 ? rowTotal : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td>
                      {DAYS.map((d, di) => {
                        const total = grid.reduce((s, row) => s + row[di], 0);
                        return <td key={d} className="pt-2 text-center text-[11px] font-semibold text-slate-500">{total > 0 ? total : ""}</td>;
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {callDetails.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">
                  No call data loaded — go to Queue Overview to load data first
                </div>
              )}
              {callDetails.length > 0 && visibleCalls.length === 0 && heatmapQueue && (
                <div className="py-12 text-center text-sm text-slate-400">
                  No calls found for queue &ldquo;{heatmapQueue}&rdquo;
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "voicemail" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Voicemail className="h-5 w-5 text-violet-500" />
                <div>
                  <h2 className="font-semibold text-slate-900">Voicemail Review</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Recent voicemails across all org users with transcriptions where available
                  </p>
                </div>
              </div>
              <button
                onClick={loadVoicemails}
                disabled={voicemailLoading}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {voicemailLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                  : voicemailData
                    ? <><RefreshCw className="h-4 w-4" />Refresh</>
                    : <><Voicemail className="h-4 w-4" />Load Voicemails</>
                }
              </button>
            </div>

            {voicemailError && (
              <div className="px-6 py-4">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700">Failed to load voicemails</p>
                  <p className="mt-0.5 text-xs text-red-600">{voicemailError}</p>
                </div>
              </div>
            )}

            {!voicemailData && !voicemailLoading && !voicemailError && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <Voicemail className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-400">Click &ldquo;Load Voicemails&rdquo; to fetch recent voicemails</p>
                <p className="mt-1 text-xs text-slate-400">Fetches last {globalDays} days across all org users</p>
              </div>
            )}

            {voicemailLoading && (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-sm text-slate-500">Fetching voicemails across all users…</p>
              </div>
            )}

            {voicemailData && !voicemailLoading && (
              <div>
                {voicemailData.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No voicemails found in the last 7 days</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {voicemailData.map((vm, i) => {
                      const mins = Math.floor(vm.duration / 60);
                      const secs = vm.duration % 60;
                      const durLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                      const receivedDate = new Date(vm.received);
                      return (
                        <div key={i} className={`px-6 py-4 ${!vm.heard ? "bg-violet-50" : ""}`}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!vm.heard ? "bg-violet-100" : "bg-slate-100"}`}>
                                <Play className={`h-3.5 w-3.5 ${!vm.heard ? "text-violet-600" : "text-slate-400"}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {vm.caller.name || vm.caller.number || "Unknown"}
                                  </p>
                                  {vm.caller.name && vm.caller.number && (
                                    <span className="text-xs text-slate-400">{vm.caller.number}</span>
                                  )}
                                  {!vm.heard && (
                                    <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">New</span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  For <span className="font-medium text-slate-700">{vm.userName}</span>
                                  {" · "}{durLabel}
                                  {" · "}{receivedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  {" "}{receivedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          </div>
                          {vm.transcription ? (
                            <div className="mt-3 rounded-lg border border-violet-100 bg-white px-4 py-3">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400">Transcript</p>
                              <p className="text-sm leading-relaxed text-slate-700">{vm.transcription}</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs italic text-slate-400">No transcript available</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
                  {voicemailData.length} voicemail{voicemailData.length !== 1 ? "s" : ""} · last {globalDays} days
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "agentstatus" && (
          <div className="space-y-5">
            {/* Header card */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-teal-500" />
                  <div>
                    <h2 className="font-semibold text-slate-900">Agent Status</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Last-known status per agent and time-on-queue breakdown — last {Math.min(globalDays, 14)} days
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadAgentStatus}
                  disabled={agentStatusLoading}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {agentStatusLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                    : agentStatusData
                      ? <><RefreshCw className="h-4 w-4" />Refresh</>
                      : <><UserCheck className="h-4 w-4" />Load Agent Status</>
                  }
                </button>
              </div>

              {agentStatusScopeError && (
                <div className="px-6 py-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">Scope not authorized</p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      The admin token needs <code className="rounded bg-amber-100 px-1">cc-analytics.v1.agent-status.read</code> scope.
                      Click <strong>Force Reconnect</strong> in the header to re-authorize GoTo and grant this scope.
                    </p>
                  </div>
                </div>
              )}

              {agentStatusError && !agentStatusScopeError && (
                <div className="px-6 py-4">
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-700">Failed to load agent status</p>
                    <p className="mt-0.5 text-xs text-red-600">{agentStatusError}</p>
                  </div>
                </div>
              )}

              {!agentStatusData && !agentStatusLoading && !agentStatusError && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <UserCheck className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">Click &ldquo;Load Agent Status&rdquo; to fetch agent data</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Requires <code className="rounded bg-slate-100 px-1">cc-analytics.v1.agent-status.read</code> scope
                  </p>
                </div>
              )}

              {agentStatusLoading && (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                  <p className="text-sm text-slate-500">Fetching agent status history…</p>
                  <p className="text-xs text-slate-400">Paginates in 24h chunks — may take a few seconds</p>
                </div>
              )}
            </div>

            {agentStatusData && !agentStatusLoading && (() => {
              // ── Helpers ──────────────────────────────────────────────────
              function fmtHm(secs: number): string {
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                if (h > 0) return `${h}h ${m}m`;
                return `${m}m`;
              }

              function statusColor(status: string): string {
                const s = status.toUpperCase();
                if (s === "AVAILABLE" || s === "READY") return "bg-emerald-100 text-emerald-700";
                if (s === "HANDLING" || s === "ON_CALL" || s === "ONCALL") return "bg-blue-100 text-blue-700";
                if (s === "WRAP_UP" || s === "WRAPUP" || s === "ACW") return "bg-indigo-100 text-indigo-700";
                if (s === "AWAY" || s === "BREAK") return "bg-amber-100 text-amber-700";
                if (s === "LOGGED_OUT" || s === "OFFLINE") return "bg-slate-100 text-slate-500";
                return "bg-slate-100 text-slate-600";
              }

              function statusDot(status: string): string {
                const s = status.toUpperCase();
                if (s === "AVAILABLE" || s === "READY") return "bg-emerald-500";
                if (s === "HANDLING" || s === "ON_CALL" || s === "ONCALL") return "bg-blue-500";
                if (s === "WRAP_UP" || s === "WRAPUP" || s === "ACW") return "bg-indigo-500";
                if (s === "AWAY" || s === "BREAK") return "bg-amber-400";
                if (s === "LOGGED_OUT" || s === "OFFLINE") return "bg-slate-300";
                return "bg-slate-400";
              }

              // Collect all status keys seen across all agents
              const allStatuses = [...new Set(
                agentStatusData.timeBreakdown.flatMap((a) => Object.keys(a.byStatus))
              )].sort();

              return (
                <>
                  {/* ── Current Status ─────────────────────────────────── */}
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-3">
                      <h3 className="text-sm font-semibold text-slate-700">Current Status</h3>
                      <p className="mt-0.5 text-xs text-slate-400">Last recorded status event per agent</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Agent</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Queue</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Duration</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Since</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {agentStatusData.currentStatuses.map((agent) => (
                            <tr key={agent.agentId} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 font-medium text-slate-900">{agent.agentName}</td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(agent.status)}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(agent.status)}`}></span>
                                  {agent.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-500">{agent.queueName || "—"}</td>
                              <td className="px-5 py-3 tabular-nums text-slate-500">{agent.durationSeconds > 0 ? fmtHm(agent.durationSeconds) : "—"}</td>
                              <td className="px-5 py-3 text-slate-400 text-xs">
                                {agent.since ? new Date(agent.since).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                              </td>
                            </tr>
                          ))}
                          {agentStatusData.currentStatuses.length === 0 && (
                            <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No agent status data returned</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Time-on-Queue Breakdown ────────────────────────── */}
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-3">
                      <h3 className="text-sm font-semibold text-slate-700">Time-on-Queue Breakdown</h3>
                      <p className="mt-0.5 text-xs text-slate-400">Total time per agent in each status — last {agentStatusData.days} days · {agentStatusData.totalEvents.toLocaleString()} events loaded</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Agent</th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</th>
                            {allStatuses.map((s) => (
                              <th key={s} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {agentStatusData.timeBreakdown.map((agent) => (
                            <tr key={agent.agentId} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 font-medium text-slate-900">{agent.agentName}</td>
                              <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-700">{fmtHm(agent.totalSeconds)}</td>
                              {allStatuses.map((s) => {
                                const secs = agent.byStatus[s] ?? 0;
                                const pct = agent.totalSeconds > 0 ? Math.round((secs / agent.totalSeconds) * 100) : 0;
                                return (
                                  <td key={s} className="px-4 py-3 text-right tabular-nums text-slate-500">
                                    {secs > 0 ? (
                                      <span title={`${pct}%`}>{fmtHm(secs)}</span>
                                    ) : (
                                      <span className="text-slate-200">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {agentStatusData.timeBreakdown.length === 0 && (
                            <tr><td colSpan={2 + allStatuses.length} className="px-5 py-10 text-center text-sm text-slate-400">No time breakdown data available</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
                      {agentStatusData.timeBreakdown.length} agents · {agentStatusData.pagesLoaded} page{agentStatusData.pagesLoaded !== 1 ? "s" : ""} loaded from GoTo
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Contact Center API Test Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-bold text-slate-900">Contact Center Analytics API Test</h2>
              </div>
              <button onClick={() => setTestModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {callerActivityLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm text-slate-500">Testing caller-activity endpoint...</p>
                </div>
              )}
              {!callerActivityLoading && callerActivityResults && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-700 text-sm">call-reports API Probe Results</h3>
                  {callerActivityResults.error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-semibold text-red-700">Request failed</p>
                      <pre className="mt-1 text-xs text-red-600">{callerActivityResults.error}</pre>
                    </div>
                  )}
                  {(callerActivityResults.results ?? []).map((r: any, i: number) => (
                    <div key={i} className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50 p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold text-blue-900 leading-snug">{r.endpoint}</h4>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${r.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}>HTTP {r.status || "Err"}</span>
                      </div>
                      {r.note && <p className="mb-2 text-xs italic text-blue-600">{r.note}</p>}
                      {r.itemCount !== undefined && (
                        <div className="mb-3 grid grid-cols-2 gap-4">
                          <div><p className="text-xs text-slate-500">Records</p><p className="mt-0.5 text-xl font-bold text-slate-900">{r.itemCount}</p></div>
                          {r.hasNextPage !== undefined && <div><p className="text-xs text-slate-500">More pages</p><p className="mt-0.5 text-xl font-bold text-slate-900">{r.hasNextPage ? "Yes" : "No"}</p></div>}
                        </div>
                      )}
                      {r.sampleUsers && r.sampleUsers.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs text-slate-500">Sample users (userId format)</p>
                          <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(r.sampleUsers, null, 2)}</pre>
                        </div>
                      )}
                      {r.sampleRecord && (
                        <div>
                          <p className="mb-1.5 text-xs text-slate-500">Sample call record (full field set)</p>
                          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(r.sampleRecord, null, 2)}</pre>
                        </div>
                      )}
                      {r.error && (
                        <pre className="max-h-40 overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">{typeof r.error === "string" ? r.error : JSON.stringify(r.error, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {testLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <p className="text-sm text-slate-500">Running API tests...</p>
                </div>
              )}
              {!testLoading && testResults && (
                <div className="space-y-5">
                  {testResults.summary && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="mb-4 font-semibold text-slate-900">Test Summary</h3>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div><p className="text-xs text-slate-500">Total Tests</p><p className="mt-0.5 text-2xl font-bold text-slate-900">{testResults.summary.totalTests}</p></div>
                        <div><p className="text-xs text-slate-500">Passed</p><p className="mt-0.5 text-2xl font-bold text-emerald-600">{testResults.summary.passed}</p></div>
                        <div><p className="text-xs text-slate-500">Failed</p><p className="mt-0.5 text-2xl font-bold text-red-500">{testResults.summary.failed}</p></div>
                        <div><p className="text-xs text-slate-500">Status</p><p className={`mt-0.5 text-sm font-bold ${testResults.summary.allPassed ? "text-emerald-600" : "text-red-500"}`}>{testResults.summary.allPassed ? "All Passed" : "Some Failed"}</p></div>
                      </div>
                      {testResults.summary.contactCenterEnabled && (
                        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-700">Contact Center Analytics API is enabled</p>
                          <p className="text-xs text-emerald-600 mt-0.5">You have access to queue-caller-details and queue-metrics endpoints.</p>
                        </div>
                      )}
                      {!testResults.summary.contactCenterEnabled && testResults.summary.failed > 0 && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                          <p className="text-sm font-semibold text-red-700">Contact Center Analytics API is not available</p>
                          <p className="text-xs text-red-600 mt-0.5">These endpoints require additional GoTo permissions or licensing.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {testResults.tests && testResults.tests.map((test: any, index: number) => (
                    <div key={index} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">{test.endpoint}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${test.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {test.success ? `OK ${test.status}` : `Error ${test.status || "Failed"}`}
                        </span>
                      </div>
                      {test.url && (
                        <div className="mb-3">
                          <p className="mb-1 text-xs text-slate-400">Endpoint URL</p>
                          <code className="block overflow-x-auto rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{test.url}</code>
                        </div>
                      )}
                      {test.success && (
                        <div className="mb-4 grid grid-cols-2 gap-4">
                          <div><p className="text-xs text-slate-500">Items Returned</p><p className="mt-0.5 text-xl font-bold text-slate-900">{test.itemCount}</p></div>
                          <div><p className="text-xs text-slate-500">Has More Pages</p><p className="mt-0.5 text-xl font-bold text-slate-900">{test.hasNextPage ? "Yes" : "No"}</p></div>
                        </div>
                      )}
                      {test.sampleData && (
                        <div>
                          <p className="mb-1.5 text-xs text-slate-400">Sample Data (First Item)</p>
                          <pre className="max-h-80 overflow-x-auto overflow-y-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-300">{JSON.stringify(test.sampleData, null, 2)}</pre>
                        </div>
                      )}
                      {test.error && (
                        <div>
                          <p className="mb-1.5 text-xs text-red-500">Error</p>
                          <pre className="max-h-40 overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">{typeof test.error === "string" ? test.error : JSON.stringify(test.error, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                  <details className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-600 hover:text-purple-600 transition-colors">View Full Raw Response</summary>
                    <pre className="mt-4 max-h-80 overflow-x-auto overflow-y-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-300">{JSON.stringify(testResults, null, 2)}</pre>
                  </details>
                </div>
              )}
              {!testLoading && testResults?.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-red-700">Error running test</p>
                  <p className="mt-1 text-sm text-red-600">{testResults.error}</p>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => setTestModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Close</button>
              <button onClick={runCallerActivityTest} disabled={callerActivityLoading || testLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {callerActivityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneForwarded className="h-4 w-4" />}Test Caller Activity API
              </button>
              <button onClick={runContactCenterTest} disabled={testLoading || callerActivityLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Run CC Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformancePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
      </div>
    }>
      <PerformancePageContent />
    </Suspense>
  );
}
