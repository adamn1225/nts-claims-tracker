"use client";

/**
 * ActivityViewer — togglable Timeline / Heatmap view for a team member's work patterns.
 *
 * Timeline view: Shows inferred working sessions for a single selected day.
 *   - Sessions are derived from CRM touch-points + GoTo phone calls.
 *   - A 30-minute gap between events = new session.
 *   - Colored tick marks inside each session bar identify the activity type.
 *
 * Heatmap view: Shows hour-of-day × day-of-week activity grid.
 *   - Aggregated over the selected date window (7 / 30 / 60 / 90 days).
 *   - Darker orange = more activity. Empty = no recorded activity.
 *   - Reveals behavioral patterns: early vs. late start, Friday falloff, etc.
 */

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, BarChart2, RefreshCw, Info, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionEvent {
    timestamp: string;
    type: "call" | "email" | "note" | "meeting" | "goto_call";
    label: string;
    durationSeconds?: number;
}

interface Session {
    id: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    events: SessionEvent[];
    sources: ("crm" | "goto")[];
}

interface SessionSummary {
    firstTouchAt: string | null;
    lastTouchAt: string | null;
    totalActiveMinutes: number;
    totalTouches: number;
    sessionCount: number;
    crmTouches: number;
    gotoCalls: number;
    gotoAvailable: boolean;
}

interface SessionsData {
    date: string;
    dayStartHour: number;
    dayEndHour: number;
    sessions: Session[];
    summary: SessionSummary;
    dataNote: string;
}

interface HeatmapCell {
    dayOfWeekIndex: number;
    dayLabel: string;
    hour: number;
    count: number;
}

interface HeatmapData {
    days: number;
    hours: number[];
    dayLabels: string[];
    cells: HeatmapCell[];
    maxCount: number;
    gotoAvailable: boolean;
    dataNote: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
    call: "bg-orange-500",
    email: "bg-blue-500",
    note: "bg-slate-400",
    meeting: "bg-purple-500",
    goto_call: "bg-orange-400",
};

const EVENT_LABELS: Record<string, string> = {
    call: "CRM call",
    email: "Email",
    note: "Note",
    meeting: "Meeting",
    goto_call: "Phone call (GoTo)",
};

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function formatHour(h: number): string {
    if (h === 0) return "12am";
    if (h < 12) return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isoToLocalDateString(isoDate: string): string {
    // returns YYYY-MM-DD in local time
    const d = new Date(isoDate + "T12:00:00"); // noon avoids DST edge
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function offsetDate(dateStr: string, days: number): string {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-CA");
}

function getIntensityClass(count: number, max: number): string {
    if (count === 0) return "bg-slate-100";
    const ratio = count / max;
    if (ratio < 0.2) return "bg-orange-100";
    if (ratio < 0.4) return "bg-orange-200";
    if (ratio < 0.6) return "bg-orange-300";
    if (ratio < 0.8) return "bg-orange-400";
    return "bg-orange-500";
}

// ─── DataNote banner ──────────────────────────────────────────────────────────

function DataNoteBanner({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{text}</span>
        </div>
    );
}

// ─── Shared session Gantt row ─────────────────────────────────────────────────

function SessionGanttRow({
    sessions,
    date,
    dayStartHour,
    dayEndHour,
    expandedSession,
    setExpandedSession,
}: {
    sessions: Session[];
    date: string;
    dayStartHour: number;
    dayEndHour: number;
    expandedSession: string | null;
    setExpandedSession: (id: string | null) => void;
}) {
    const dayDurationMs = (dayEndHour - dayStartHour) * 3600000;

    const pct = (iso: string) => {
        const eventMs = new Date(iso).getTime();
        const dayStartMs = new Date(`${date}T${String(dayStartHour).padStart(2, "0")}:00:00`).getTime();
        return Math.min(100, Math.max(0, ((eventMs - dayStartMs) / dayDurationMs) * 100));
    };

    return (
        <div className="relative h-8 rounded-lg bg-slate-100">
            {sessions.map((session) => {
                const leftPct = pct(session.startTime);
                const widthPct = pct(session.endTime) - leftPct;
                const isExpanded = expandedSession === session.id;
                return (
                    <button
                        key={session.id}
                        onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                        className={`absolute top-1 bottom-1 rounded transition-all ${isExpanded ? "bg-orange-600 ring-2 ring-orange-400" : "bg-orange-400 hover:bg-orange-500"}`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
                        title={`${formatTime(session.startTime)} – ${formatTime(session.endTime)} (${session.durationMinutes}m, ${session.events.length} events)`}
                    >
                        {session.events.map((evt, i) => {
                            const evtLeftPct = pct(evt.timestamp);
                            const relPct = widthPct > 0 ? ((evtLeftPct - leftPct) / widthPct) * 100 : 50;
                            return (
                                <span
                                    key={i}
                                    className={`absolute top-0.5 bottom-0.5 w-0.5 rounded-full ${EVENT_COLORS[evt.type] ?? "bg-white"} opacity-70`}
                                    style={{ left: `${Math.min(98, Math.max(1, relPct))}%` }}
                                />
                            );
                        })}
                    </button>
                );
            })}
        </div>
    );
}

// Expand panel for a single session
function SessionDetailPanel({ session }: { session: Session }) {
    return (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                    {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    <span className="ml-2 text-xs font-normal text-slate-500">({formatDuration(session.durationMinutes)})</span>
                </span>
                <div className="flex gap-1">
                    {session.sources.includes("goto") && (
                        <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-medium text-orange-800">GoTo calls</span>
                    )}
                    {session.sources.includes("crm") && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">CRM activity</span>
                    )}
                </div>
            </div>
            <div className="space-y-1">
                {session.events.map((evt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${EVENT_COLORS[evt.type] ?? "bg-slate-400"}`} />
                        <span className="text-slate-400 tabular-nums">{formatTime(evt.timestamp)}</span>
                        <span className="font-medium">{EVENT_LABELS[evt.type] ?? evt.type}</span>
                        {evt.durationSeconds != null && evt.durationSeconds > 0 && (
                            <span className="text-slate-400">
                                {evt.durationSeconds < 60 ? `${evt.durationSeconds}s` : `${Math.round(evt.durationSeconds / 60)}m`}
                            </span>
                        )}
                        {evt.label && evt.label !== evt.type && (
                            <span className="truncate text-slate-400">{evt.label}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function EventLegend() {
    return (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Event types:</span>
            {Object.entries(EVENT_LABELS).map(([type, label]) => (
                <span key={type} className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${EVENT_COLORS[type]}`} />
                    {label}
                </span>
            ))}
            <span className="ml-auto text-[10px] text-slate-400">Click a session bar to expand</span>
        </div>
    );
}

// ─── Timeline View ────────────────────────────────────────────────────────────

const DAY_START = 6;
const DAY_END = 20;

function SingleDayTimeline({ teamMemberId }: { teamMemberId: string }) {
    const today = new Date().toLocaleDateString("en-CA");
    const [date, setDate] = useState(today);
    const [data, setData] = useState<SessionsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/sales-monitor/activity-sessions?teamMemberId=${teamMemberId}&date=${date}`);
            if (!res.ok) { setError((await res.json()).error || "Failed to load sessions"); return; }
            setData(await res.json());
        } catch (e) { setError(String(e)); }
        finally { setLoading(false); }
    }, [teamMemberId, date]);

    useEffect(() => { load(); }, [load]);

    const hourTicks = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);

    return (
        <div className="space-y-4">
            {/* Date navigator */}
            <div className="flex items-center gap-2">
                <button onClick={() => setDate(offsetDate(date, -1))} className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-orange-400 focus:outline-none" />
                <button onClick={() => setDate(offsetDate(date, 1))} disabled={date >= today}
                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={load} disabled={loading}
                    className="ml-auto flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
            </div>

            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            {loading && (
                <div className="flex h-32 items-center justify-center text-slate-400 text-sm">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading sessions...
                </div>
            )}

            {!loading && data && (
                <>
                    <DataNoteBanner text={data.dataNote} />
                    {data.summary.totalTouches > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                                { label: "First touch", value: data.summary.firstTouchAt ? formatTime(data.summary.firstTouchAt) : "—", tip: "Earliest recorded CRM or phone activity of the day" },
                                { label: "Last touch", value: data.summary.lastTouchAt ? formatTime(data.summary.lastTouchAt) : "—", tip: "Latest recorded activity — approximate end of work" },
                                { label: "Active time", value: formatDuration(data.summary.totalActiveMinutes), tip: "Total duration of all inferred working sessions (includes 10-min trailing buffer)" },
                                { label: "Touch-points", value: `${data.summary.totalTouches}`, tip: `${data.summary.crmTouches} CRM actions${data.summary.gotoAvailable ? ` + ${data.summary.gotoCalls} GoTo calls` : ""}` },
                            ].map((stat) => (
                                <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                    <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                                    <div className="text-xs font-medium text-slate-600">{stat.label}</div>
                                    <div className="mt-0.5 text-[10px] text-slate-400">{stat.tip}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                            No activity recorded on this date
                        </div>
                    )}

                    {data.sessions.length > 0 && (
                        <div className="space-y-1">
                            {/* Hour labels */}
                            <div className="relative h-5">
                                {hourTicks.map((h) => (
                                    <span key={h} className="absolute -translate-x-1/2 text-[10px] text-slate-400"
                                        style={{ left: `${((h - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>
                                        {formatHour(h)}
                                    </span>
                                ))}
                            </div>
                            {/* Hour grid + session bars */}
                            <div className="relative h-8 rounded-lg bg-slate-100">
                                {hourTicks.map((h) => (
                                    <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-200"
                                        style={{ left: `${((h - DAY_START) / (DAY_END - DAY_START)) * 100}%` }} />
                                ))}
                                <SessionGanttRow sessions={data.sessions} date={date} dayStartHour={DAY_START} dayEndHour={DAY_END}
                                    expandedSession={expandedSession} setExpandedSession={setExpandedSession} />
                            </div>
                            {/* Expanded detail */}
                            {data.sessions.map((s) => expandedSession === s.id ? <SessionDetailPanel key={s.id} session={s} /> : null)}
                            <EventLegend />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Date-Range Timeline ──────────────────────────────────────────────────────

interface DayResult { date: string; data: SessionsData | null; error: string | null }

function DateRangeTimeline({ teamMemberId }: { teamMemberId: string }) {
    const today = new Date().toLocaleDateString("en-CA");
    const [startDate, setStartDate] = useState(offsetDate(today, -6)); // last 7 days default
    const [endDate, setEndDate] = useState(today);
    const [rows, setRows] = useState<DayResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    // Build array of dates between start and end (inclusive, max 14)
    function datesBetween(start: string, end: string): string[] {
        const dates: string[] = [];
        let cur = start;
        while (cur <= end && dates.length < 14) {
            dates.push(cur);
            cur = offsetDate(cur, 1);
        }
        return dates;
    }

    const load = useCallback(async () => {
        if (!startDate || !endDate || startDate > endDate) return;
        setLoading(true);
        setRows([]);
        const dates = datesBetween(startDate, endDate);
        const results = await Promise.all(
            dates.map(async (d): Promise<DayResult> => {
                try {
                    const res = await fetch(`/api/sales-monitor/activity-sessions?teamMemberId=${teamMemberId}&date=${d}`);
                    if (!res.ok) return { date: d, data: null, error: (await res.json()).error || "Error" };
                    return { date: d, data: await res.json(), error: null };
                } catch (e) {
                    return { date: d, data: null, error: String(e) };
                }
            })
        );
        setRows(results);
        setLoading(false);
    }, [teamMemberId, startDate, endDate]);

    useEffect(() => { load(); }, [load]);

    const hourTicks = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);

    // Aggregate totals across the range
    const totals = rows.reduce(
        (acc, row) => {
            if (!row.data) return acc;
            acc.touches += row.data.summary.totalTouches;
            acc.activeMinutes += row.data.summary.totalActiveMinutes;
            acc.activeDays += row.data.summary.totalTouches > 0 ? 1 : 0;
            return acc;
        },
        { touches: 0, activeMinutes: 0, activeDays: 0 }
    );

    // Find first dataNote from any row for the banner
    const dataNote = rows.find((r) => r.data?.dataNote)?.data?.dataNote ?? "";

    return (
        <div className="space-y-4">
            {/* Date range pickers */}
            <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-slate-600">From</label>
                <input type="date" value={startDate} max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-orange-400 focus:outline-none" />
                <label className="text-xs font-medium text-slate-600">To</label>
                <input type="date" value={endDate} max={today} min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-orange-400 focus:outline-none" />
                <span className="text-[10px] text-slate-400">(max 14 days)</span>
                <button onClick={load} disabled={loading}
                    className="ml-auto flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
            </div>

            {loading && (
                <div className="flex h-32 items-center justify-center text-slate-400 text-sm">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading sessions...
                </div>
            )}

            {!loading && rows.length > 0 && (
                <>
                    {dataNote && <DataNoteBanner text={dataNote} />}

                    {/* Range totals */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "Active days", value: `${totals.activeDays} / ${rows.length}`, tip: "Days with at least one recorded activity" },
                            { label: "Total touch-points", value: `${totals.touches}`, tip: "Combined CRM + GoTo events across the range" },
                            { label: "Total active time", value: formatDuration(totals.activeMinutes), tip: "Sum of all inferred session durations" },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                                <div className="text-xs font-medium text-slate-600">{stat.label}</div>
                                <div className="mt-0.5 text-[10px] text-slate-400">{stat.tip}</div>
                            </div>
                        ))}
                    </div>

                    {/* Hour axis — shown once above the rows */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-20 shrink-0" /> {/* label column spacer */}
                            <div className="relative h-4 flex-1">
                                {hourTicks.map((h) => (
                                    <span key={h} className="absolute -translate-x-1/2 text-[10px] text-slate-400"
                                        style={{ left: `${((h - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>
                                        {formatHour(h)}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {rows.map((row) => {
                            const hasSessions = (row.data?.sessions.length ?? 0) > 0;
                            const label = new Date(row.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                            return (
                                <div key={row.date}>
                                    <div className="flex items-center gap-2">
                                        {/* Day label */}
                                        <div className="w-20 shrink-0 text-right text-[11px] font-medium text-slate-600">{label}</div>
                                        {/* Gantt bar or empty state */}
                                        <div className="flex-1">
                                            {row.error ? (
                                                <div className="flex h-8 items-center rounded-lg bg-red-50 px-2 text-[10px] text-red-500">{row.error}</div>
                                            ) : !hasSessions ? (
                                                <div className="flex h-8 items-center rounded-lg bg-slate-50 px-3 text-[10px] text-slate-400 italic">No activity</div>
                                            ) : (
                                                <div className="relative">
                                                    {/* Grid lines */}
                                                    <div className="relative h-8 rounded-lg bg-slate-100">
                                                        {hourTicks.map((h) => (
                                                            <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-200"
                                                                style={{ left: `${((h - DAY_START) / (DAY_END - DAY_START)) * 100}%` }} />
                                                        ))}
                                                        <SessionGanttRow sessions={row.data!.sessions} date={row.date}
                                                            dayStartHour={DAY_START} dayEndHour={DAY_END}
                                                            expandedSession={expandedSession} setExpandedSession={setExpandedSession} />
                                                    </div>
                                                    {/* Touch count badge */}
                                                    <span className="ml-2 text-[10px] text-slate-400">
                                                        {row.data!.summary.totalTouches} touch-point{row.data!.summary.totalTouches !== 1 ? "s" : ""}
                                                        {" · "}{formatDuration(row.data!.summary.totalActiveMinutes)} active
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Expanded session detail — shown inline below its row */}
                                    {row.data?.sessions.map((s) =>
                                        expandedSession === s.id ? (
                                            <div key={s.id} className="ml-22 mt-1">
                                                <SessionDetailPanel session={s} />
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <EventLegend />
                </>
            )}
        </div>
    );
}

function TimelineView({ teamMemberId }: { teamMemberId: string }) {
    const [mode, setMode] = useState<"single" | "range">("single");

    return (
        <div className="space-y-4">
            {/* Single / Range toggle */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setMode("single")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${mode === "single" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
                >
                    Single Day
                </button>
                <button
                    onClick={() => setMode("range")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${mode === "range" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
                >
                    Date Range
                </button>
            </div>
            {mode === "single" ? <SingleDayTimeline teamMemberId={teamMemberId} /> : <DateRangeTimeline teamMemberId={teamMemberId} />}
        </div>
    );
}

// ─── Heatmap View ─────────────────────────────────────────────────────────────

function HeatmapView({ teamMemberId, days }: { teamMemberId: string; days: number }) {
    const [data, setData] = useState<HeatmapData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/sales-monitor/activity-heatmap?teamMemberId=${teamMemberId}&days=${days}`);            if (!res.ok) {
                const e = await res.json();
                setError(e.error || "Failed to load heatmap");
                return;
            }
            setData(await res.json());
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [teamMemberId, days]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Building heatmap...
            </div>
        );
    }

    if (error) {
        return <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>;
    }

    if (!data) return null;

    const { hours, dayLabels, cells, maxCount } = data;

    // Build lookup: [dayIndex][hour] = count
    const lookup: Record<number, Record<number, number>> = {};
    for (const cell of cells) {
        if (!lookup[cell.dayOfWeekIndex]) lookup[cell.dayOfWeekIndex] = {};
        lookup[cell.dayOfWeekIndex][cell.hour] = cell.count;
    }

    return (
        <div className="space-y-4">
            <DataNoteBanner text={data.dataNote} />

            {maxCount === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                    No activity recorded in this period
                </div>
            )}

            {maxCount > 0 && (
                <div className="overflow-x-auto">
                    <div className="min-w-120">
                        {/* Column headers: day labels */}
                        <div className="mb-1 grid text-center text-xs font-medium text-slate-500"
                            style={{ gridTemplateColumns: `4rem repeat(${dayLabels.length}, 1fr)` }}>
                            <div /> {/* spacer for hour column */}
                            {dayLabels.map((d) => (
                                <div key={d}>{d}</div>
                            ))}
                        </div>

                        {/* Grid rows: one per hour */}
                        <div className="space-y-0.5">
                            {hours.map((hour) => (
                                <div
                                    key={hour}
                                    className="grid items-center"
                                    style={{ gridTemplateColumns: `4rem repeat(${dayLabels.length}, 1fr)` }}
                                >
                                    {/* Hour label */}
                                    <div className="pr-2 text-right text-[10px] text-slate-400">{formatHour(hour)}</div>
                                    {/* Cells */}
                                    {dayLabels.map((_, dayIdx) => {
                                        const count = lookup[dayIdx]?.[hour] ?? 0;
                                        const intensityClass = getIntensityClass(count, maxCount);
                                        return (
                                            <div
                                                key={dayIdx}
                                                className={`relative mx-0.5 h-6 rounded-sm cursor-default transition-all ${intensityClass} hover:ring-2 hover:ring-orange-400`}
                                                onMouseEnter={() =>
                                                    setHoveredCell({
                                                        dayOfWeekIndex: dayIdx,
                                                        dayLabel: dayLabels[dayIdx],
                                                        hour,
                                                        count,
                                                    })
                                                }
                                                onMouseLeave={() => setHoveredCell(null)}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Hovered cell tooltip */}
                        {hoveredCell && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                <span className="font-semibold">{hoveredCell.dayLabel} {formatHour(hoveredCell.hour)}</span>
                                {" — "}
                                {hoveredCell.count === 0
                                    ? "No activity recorded"
                                    : `${hoveredCell.count} event${hoveredCell.count !== 1 ? "s" : ""} across the period`}
                            </div>
                        )}

                        {/* Intensity legend */}
                        <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
                            <span>Less active</span>
                            {["bg-slate-100", "bg-orange-100", "bg-orange-200", "bg-orange-300", "bg-orange-400", "bg-orange-500"].map((cls) => (
                                <div key={cls} className={`h-3 w-5 rounded-sm ${cls}`} />
                            ))}
                            <span>More active</span>
                        </div>

                        <p className="mt-2 text-[10px] text-slate-400">
                            Each cell is the total events (CRM + GoTo) in that hour across all {dayLabels.length === 5 ? "weekdays" : "days"} in the selected period.
                            Hover a cell for the exact count.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Exported Component ───────────────────────────────────────────────────────

interface ActivityViewerProps {
    teamMemberId: string;
    teamMemberName: string;
    days: number;
}

export default function ActivityViewer({ teamMemberId, teamMemberName, days }: ActivityViewerProps) {
    const [view, setView] = useState<"timeline" | "heatmap">("timeline");

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Header + toggle */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-slate-900">
                        Work Pattern Analysis —{" "}
                        <span className="text-orange-600">{teamMemberName}</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                        When is this teamMember active? Sessions are inferred from CRM activity and GoTo phone calls.
                    </p>
                </div>

                {/* View toggle */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                        onClick={() => setView("timeline")}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${view === "timeline"
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        <CalendarDays className="h-3.5 w-3.5" />
                        Daily Timeline
                    </button>
                    <button
                        onClick={() => setView("heatmap")}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${view === "heatmap"
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        <BarChart2 className="h-3.5 w-3.5" />
                        Weekly Heatmap
                    </button>
                </div>
            </div>

            {/* View content */}
            {view === "timeline" && <TimelineView teamMemberId={teamMemberId} />}
            {view === "heatmap" && <HeatmapView teamMemberId={teamMemberId} days={days} />}
        </section>
    );
}
