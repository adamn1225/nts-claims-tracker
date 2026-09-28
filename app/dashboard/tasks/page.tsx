"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertCircle,
    CheckCircle2,
    Circle,
    Clock,
    Filter,
    Inbox,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";

// -----------------------------------------------------------------------------
// Types + enum labels (kept aligned with the claim-scoped panel + DB enums)
// -----------------------------------------------------------------------------

const TASK_TYPES = [
    { value: "send_acknowledgment", label: "Send acknowledgment" },
    { value: "request_bol", label: "Request BOL" },
    { value: "request_pod", label: "Request POD" },
    { value: "request_photos", label: "Request photos" },
    { value: "request_repair_estimate", label: "Request repair estimate" },
    { value: "request_presentation_of_loss", label: "Request presentation of loss" },
    { value: "request_witness_statement", label: "Request witness statement" },
    { value: "follow_up_shipper", label: "Follow up: shipper" },
    { value: "follow_up_customer", label: "Follow up: customer" },
    { value: "follow_up_carrier", label: "Follow up: carrier" },
    { value: "follow_up_factoring", label: "Follow up: factoring" },
    { value: "follow_up_accounts_payable", label: "Follow up: accounts payable" },
    { value: "follow_up_insurer", label: "Follow up: insurer" },
    { value: "internal_review", label: "Internal review" },
    { value: "manager_approval", label: "Manager approval" },
    { value: "place_carrier_hold", label: "Place carrier hold" },
    { value: "release_carrier_hold", label: "Release carrier hold" },
    { value: "prepare_settlement", label: "Prepare settlement" },
    { value: "close_claim", label: "Close claim" },
    { value: "other", label: "Other" },
] as const;

const PRIORITIES = [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
] as const;

type TaskTypeValue = (typeof TASK_TYPES)[number]["value"];
type TaskPriority = (typeof PRIORITIES)[number]["value"];
type TaskStatus = "open" | "in_progress" | "blocked" | "completed" | "cancelled";
type TabKey = "today" | "overdue" | "upcoming" | "no_due" | "completed";
type Scope = "mine" | "team";

type ProfileRef = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
};

type ClaimRef = {
    id: string;
    claim_number: string;
    status_id: string | null;
};

type TaskRow = {
    id: string;
    claim_id: string;
    title: string;
    description: string | null;
    type: TaskTypeValue;
    priority: TaskPriority;
    status: TaskStatus;
    due_at: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    claim: ClaimRef | null;
    assigned: ProfileRef | null;
    creator: ProfileRef | null;
};

type Assignee = ProfileRef & { office_location: string | null };

type ClaimOption = { id: string; claim_number: string };

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const typeLabel = (t: string) => TASK_TYPES.find((x) => x.value === t)?.label ?? t;
const priorityLabel = (p: string) => PRIORITIES.find((x) => x.value === p)?.label ?? p;

const personName = (p: ProfileRef | null | undefined) => {
    if (!p) return "";
    const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    return n || p.email || "";
};

const isSameLocalDay = (iso: string | null, day: Date) => {
    if (!iso) return false;
    const d = new Date(iso);
    return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
    );
};

const startOfLocalDay = (base = new Date()) => {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    return d;
};

const priorityTone = (p: TaskPriority) => {
    switch (p) {
        case "critical":
            return "bg-danger/10 text-danger border-danger/30";
        case "high":
            return "bg-primary/10 text-primary-text border-primary/30";
        case "low":
            return "bg-slate-100 text-slate-600 border-slate-200";
        default:
            return "bg-info/10 text-info-text border-info/30";
    }
};

const relDue = (iso: string | null) => {
    if (!iso) return { label: "No due date", overdue: false };
    const due = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = due - now;
    const absMs = Math.abs(diffMs);
    const days = Math.floor(absMs / 86_400_000);
    const hours = Math.floor(absMs / 3_600_000);
    if (diffMs < 0) {
        if (days >= 1) return { label: `${days}d overdue`, overdue: true };
        if (hours >= 1) return { label: `${hours}h overdue`, overdue: true };
        return { label: "Just overdue", overdue: true };
    }
    if (days >= 1) return { label: `in ${days}d`, overdue: false };
    if (hours >= 1) return { label: `in ${hours}h`, overdue: false };
    return { label: "soon", overdue: false };
};

const fmtDueAbs = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const toDueAt = (date: string, time: string | null) => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh = 9, mm = 0] = (time ?? "09:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm).toISOString();
};

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

function TasksWorkspaceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createClient(), []);

    const initialTab = (searchParams.get("tab") as TabKey | null) ?? "today";
    const initialScope = (searchParams.get("scope") as Scope | null) ?? "mine";

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<TaskRow[]>([]);
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [claims, setClaims] = useState<ClaimOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [tab, setTab] = useState<TabKey>(initialTab);
    const [scope, setScope] = useState<Scope>(initialScope);
    const [assigneeFilter, setAssigneeFilter] = useState<string>("");
    const [priorityFilter, setPriorityFilter] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    const [showNew, setShowNew] = useState(false);

    // Keep URL in sync so this view is bookmarkable / shareable.
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        params.set("scope", scope);
        router.replace(`/dashboard/tasks?${params.toString()}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, scope]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const {
            data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const [tasksRes, usersRes, claimsRes] = await Promise.all([
            supabase
                .from("tasks")
                .select(
                    `id, claim_id, title, description, type, priority, status, due_at,
           assigned_to, created_at, updated_at, completed_at,
           claim:claims!tasks_claim_id_fkey ( id, claim_number, status_id ),
           assigned:profiles!tasks_assigned_to_fkey ( id, first_name, last_name, email ),
           creator:profiles!tasks_created_by_fkey ( id, first_name, last_name, email )`,
                )
                .order("due_at", { ascending: true, nullsFirst: false })
                .order("created_at", { ascending: false }),
            supabase
                .from("profiles")
                .select("id, first_name, last_name, email, office_location")
                .eq("is_active", true)
                .in("role", ["admin", "manager", "claims_staff"])
                .order("first_name"),
            supabase
                .from("claims")
                .select("id, claim_number")
                .order("last_activity_at", { ascending: false })
                .limit(500),
        ]);

        if (tasksRes.error) setError(tasksRes.error.message);

        setTasks((tasksRes.data ?? []) as unknown as TaskRow[]);
        setAssignees((usersRes.data ?? []) as Assignee[]);
        setClaims((claimsRes.data ?? []) as ClaimOption[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        load();
    }, [load]);

    const counts = useMemo(() => {
        const now = new Date();
        const today = startOfLocalDay(now);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const inSevenDays = new Date(today);
        inSevenDays.setDate(today.getDate() + 7);

        const scopedForCounts =
            scope === "mine" && currentUserId
                ? tasks.filter((t) => t.assigned_to === currentUserId)
                : tasks;

        const active = (t: TaskRow) =>
            t.status !== "completed" && t.status !== "cancelled";

        return {
            today: scopedForCounts.filter(
                (t) => active(t) && isSameLocalDay(t.due_at, today),
            ).length,
            overdue: scopedForCounts.filter(
                (t) =>
                    active(t) &&
                    t.due_at != null &&
                    new Date(t.due_at).getTime() < now.getTime() &&
                    !isSameLocalDay(t.due_at, today),
            ).length,
            upcoming: scopedForCounts.filter((t) => {
                if (!active(t) || !t.due_at) return false;
                const d = new Date(t.due_at);
                return d >= tomorrow && d <= inSevenDays;
            }).length,
            no_due: scopedForCounts.filter((t) => active(t) && t.due_at == null)
                .length,
            completed: scopedForCounts.filter((t) => t.status === "completed").length,
        };
    }, [tasks, scope, currentUserId]);

    const filtered = useMemo(() => {
        const now = new Date();
        const today = startOfLocalDay(now);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const inSevenDays = new Date(today);
        inSevenDays.setDate(today.getDate() + 7);

        let out = tasks;
        if (scope === "mine" && currentUserId) {
            out = out.filter((t) => t.assigned_to === currentUserId);
        }

        const active = (t: TaskRow) =>
            t.status !== "completed" && t.status !== "cancelled";

        switch (tab) {
            case "today":
                out = out.filter((t) => active(t) && isSameLocalDay(t.due_at, today));
                break;
            case "overdue":
                out = out.filter(
                    (t) =>
                        active(t) &&
                        t.due_at != null &&
                        new Date(t.due_at).getTime() < now.getTime() &&
                        !isSameLocalDay(t.due_at, today),
                );
                break;
            case "upcoming":
                out = out.filter((t) => {
                    if (!active(t) || !t.due_at) return false;
                    const d = new Date(t.due_at);
                    return d >= tomorrow && d <= inSevenDays;
                });
                break;
            case "no_due":
                out = out.filter((t) => active(t) && t.due_at == null);
                break;
            case "completed":
                out = out.filter((t) => t.status === "completed");
                break;
        }

        if (assigneeFilter) {
            out =
                assigneeFilter === "__unassigned__"
                    ? out.filter((t) => t.assigned_to == null)
                    : out.filter((t) => t.assigned_to === assigneeFilter);
        }
        if (priorityFilter) out = out.filter((t) => t.priority === priorityFilter);
        if (typeFilter) out = out.filter((t) => t.type === typeFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            out = out.filter(
                (t) =>
                    t.title.toLowerCase().includes(q) ||
                    (t.description ?? "").toLowerCase().includes(q) ||
                    (t.claim?.claim_number ?? "").toLowerCase().includes(q),
            );
        }
        return out;
    }, [
        tasks,
        scope,
        currentUserId,
        tab,
        assigneeFilter,
        priorityFilter,
        typeFilter,
        search,
    ]);

    const patchTask = async (
        claimId: string,
        taskId: string,
        patch: Record<string, unknown>,
    ) => {
        try {
            const res = await fetch(`/api/claims/${claimId}/tasks`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: taskId, ...patch }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Update failed");
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
                    <p className="text-sm text-slate-500">
                        Follow-ups and checklist items across every claim you have access
                        to.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={load}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowNew(true)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-text"
                    >
                        <Plus className="h-4 w-4" /> New task
                    </button>
                </div>
            </header>

            {/* Scope + tab strip */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => setScope("mine")}
                        className={`rounded px-3 py-1.5 font-medium ${scope === "mine"
                            ? "bg-primary text-white"
                            : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        Mine
                    </button>
                    <button
                        type="button"
                        onClick={() => setScope("team")}
                        className={`rounded px-3 py-1.5 font-medium ${scope === "team"
                            ? "bg-primary text-white"
                            : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        Team
                    </button>
                </div>

                <nav className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs">
                    <TabButton
                        active={tab === "today"}
                        onClick={() => setTab("today")}
                        label="Today"
                        count={counts.today}
                    />
                    <TabButton
                        active={tab === "overdue"}
                        onClick={() => setTab("overdue")}
                        label="Overdue"
                        count={counts.overdue}
                        tone={counts.overdue > 0 ? "danger" : undefined}
                    />
                    <TabButton
                        active={tab === "upcoming"}
                        onClick={() => setTab("upcoming")}
                        label="Upcoming"
                        count={counts.upcoming}
                    />
                    <TabButton
                        active={tab === "no_due"}
                        onClick={() => setTab("no_due")}
                        label="No due date"
                        count={counts.no_due}
                    />
                    <TabButton
                        active={tab === "completed"}
                        onClick={() => setTab("completed")}
                        label="Completed"
                        count={counts.completed}
                    />
                </nav>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-white p-2 sm:grid-cols-4">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tasks or claim #"
                        className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                {scope === "team" && (
                    <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    >
                        <option value="">All assignees</option>
                        <option value="__unassigned__">Unassigned</option>
                        {assignees.map((a) => (
                            <option key={a.id} value={a.id}>
                                {personName(a) || "Unnamed"}
                            </option>
                        ))}
                    </select>
                )}
                <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">All priorities</option>
                    {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                            {p.label}
                        </option>
                    ))}
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">All types</option>
                    {TASK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>
                        {filtered.length} {filtered.length === 1 ? "task" : "tasks"}
                    </span>
                    {(assigneeFilter || priorityFilter || typeFilter || search) && (
                        <button
                            type="button"
                            onClick={() => {
                                setAssigneeFilter("");
                                setPriorityFilter("");
                                setTypeFilter("");
                                setSearch("");
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700"
                        >
                            <Filter className="h-3 w-3" /> Clear filters
                        </button>
                    )}
                </div>
                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
                        <Inbox className="h-8 w-8" />
                        <p className="text-sm">No tasks match these filters.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {filtered.map((t) => (
                            <TaskRowItem
                                key={t.id}
                                task={t}
                                currentUserId={currentUserId}
                                assignees={assignees}
                                onToggleComplete={() =>
                                    patchTask(t.claim_id, t.id, {
                                        status: t.status === "completed" ? "open" : "completed",
                                    })
                                }
                                onReassign={(userId) =>
                                    patchTask(t.claim_id, t.id, {
                                        assigned_to: userId,
                                    })
                                }
                            />
                        ))}
                    </ul>
                )}
            </div>

            {showNew && (
                <NewTaskModal
                    onClose={() => setShowNew(false)}
                    onCreated={() => {
                        setShowNew(false);
                        load();
                    }}
                    assignees={assignees}
                    claims={claims}
                />
            )}
        </main>
    );
}

export default function TasksWorkspacePage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
            }
        >
            <TasksWorkspaceContent />
        </Suspense>
    );
}

// -----------------------------------------------------------------------------
// Row + New task modal
// -----------------------------------------------------------------------------

function TabButton({
    active,
    onClick,
    label,
    count,
    tone,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
    tone?: "danger";
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded px-2.5 py-1 font-medium ${active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
                }`}
        >
            {label}
            <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active
                    ? "bg-white/20 text-white"
                    : tone === "danger" && count > 0
                        ? "bg-danger/10 text-danger"
                        : "bg-slate-100 text-slate-600"
                    }`}
            >
                {count}
            </span>
        </button>
    );
}

function TaskRowItem({
    task,
    currentUserId,
    assignees,
    onToggleComplete,
    onReassign,
}: {
    task: TaskRow;
    currentUserId: string | null;
    assignees: Assignee[];
    onToggleComplete: () => void;
    onReassign: (userId: string | null) => void;
}) {
    const due = relDue(task.due_at);
    const isDone = task.status === "completed";
    const assignedToMe = task.assigned_to === currentUserId;
    return (
        <li className="grid grid-cols-1 gap-2 px-3 py-3 hover:bg-slate-50 sm:grid-cols-[auto_1fr_180px_160px_120px]">
            <button
                type="button"
                onClick={onToggleComplete}
                title={isDone ? "Mark as open" : "Mark complete"}
                className={`self-start rounded-full p-0.5 transition ${isDone ? "text-success" : "text-slate-300 hover:text-slate-500"
                    }`}
            >
                {isDone ? (
                    <CheckCircle2 className="h-5 w-5" />
                ) : (
                    <Circle className="h-5 w-5" />
                )}
            </button>

            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p
                        className={`text-sm font-medium ${isDone ? "text-slate-500 line-through" : "text-slate-900"
                            }`}
                    >
                        {task.title}
                    </p>
                    <span
                        className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${priorityTone(task.priority)}`}
                    >
                        {priorityLabel(task.priority)}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0 text-[10px] font-medium text-slate-600">
                        {typeLabel(task.type)}
                    </span>
                    {assignedToMe && !isDone && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary-text">
                            You
                        </span>
                    )}
                </div>
                {task.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {task.description}
                    </p>
                )}
                {task.claim && (
                    <Link
                        href={`/dashboard/claims/${task.claim.id}`}
                        className="mt-0.5 inline-block font-mono text-[11px] font-semibold text-accent hover:underline"
                    >
                        {task.claim.claim_number}
                    </Link>
                )}
            </div>

            <div className="text-xs text-slate-500">
                <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{fmtDueAbs(task.due_at)}</span>
                </div>
                {task.due_at && (
                    <span
                        className={
                            due.overdue ? "text-danger font-semibold" : "text-slate-400"
                        }
                    >
                        {due.label}
                    </span>
                )}
            </div>

            <select
                value={task.assigned_to ?? ""}
                onChange={(e) => onReassign(e.target.value || null)}
                title="Reassign task"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                        {personName(a) || "Unnamed"}
                    </option>
                ))}
            </select>

            <div className="text-right text-[11px] text-slate-400">
                {isDone && task.completed_at
                    ? `Completed ${fmtDueAbs(task.completed_at)}`
                    : ""}
            </div>
        </li>
    );
}

function NewTaskModal({
    onClose,
    onCreated,
    assignees,
    claims,
}: {
    onClose: () => void;
    onCreated: () => void;
    assignees: Assignee[];
    claims: ClaimOption[];
}) {
    const [claimQuery, setClaimQuery] = useState("");
    const [claimId, setClaimId] = useState<string>("");
    const [title, setTitle] = useState("");
    const [type, setType] = useState<TaskTypeValue>("follow_up_carrier");
    const [priority, setPriority] = useState<TaskPriority>("normal");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [assignee, setAssignee] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filteredClaims = useMemo(() => {
        const q = claimQuery.trim().toLowerCase();
        const list = q
            ? claims.filter((c) => c.claim_number.toLowerCase().includes(q))
            : claims;
        return list.slice(0, 20);
    }, [claims, claimQuery]);

    const selectedClaim = claims.find((c) => c.id === claimId);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!claimId) {
            setError("Please pick a claim first.");
            return;
        }
        if (!title.trim()) {
            setError("Title is required.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/claims/${claimId}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    type,
                    priority,
                    description: description.trim() || null,
                    due_at: toDueAt(dueDate, dueTime || null),
                    assigned_to: assignee || null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Failed to create task");
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    const inputClass =
        "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

    return (
        <Modal isOpen onClose={onClose} title="New task">
            <form onSubmit={submit} className="space-y-3 px-6 py-5">
                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                        Claim <span className="text-danger">*</span>
                    </label>
                    {selectedClaim ? (
                        <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm">
                            <span className="font-mono font-semibold text-slate-900">
                                {selectedClaim.claim_number}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setClaimId("");
                                    setClaimQuery("");
                                }}
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Clear claim"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                type="search"
                                value={claimQuery}
                                onChange={(e) => setClaimQuery(e.target.value)}
                                placeholder="Search by claim number…"
                                className={inputClass}
                                autoFocus
                            />
                            {claimQuery.trim().length > 0 && (
                                <ul className="mt-1 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                                    {filteredClaims.length === 0 && (
                                        <li className="px-3 py-2 text-xs text-slate-500">
                                            No matches.
                                        </li>
                                    )}
                                    {filteredClaims.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setClaimId(c.id);
                                                    setClaimQuery(c.claim_number);
                                                }}
                                                className="block w-full px-3 py-1.5 text-left font-mono text-xs hover:bg-slate-50"
                                            >
                                                {c.claim_number}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>

                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-700">
                        Title <span className="text-danger">*</span>
                    </span>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Follow up with carrier on repair estimate"
                        className={inputClass}
                    />
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-700">
                            Type
                        </span>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as TaskTypeValue)}
                            className={inputClass}
                        >
                            {TASK_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-700">
                            Priority
                        </span>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as TaskPriority)}
                            className={inputClass}
                        >
                            {PRIORITIES.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-700">
                            Due date
                        </span>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={inputClass}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-700">
                            Due time
                        </span>
                        <input
                            type="time"
                            value={dueTime}
                            onChange={(e) => setDueTime(e.target.value)}
                            className={inputClass}
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-700">
                        Assign to
                    </span>
                    <select
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Unassigned</option>
                        {assignees.map((a) => (
                            <option key={a.id} value={a.id}>
                                {personName(a) || "Unnamed"}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-700">
                        Notes
                    </span>
                    <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Context, deadlines, links, etc."
                        className={inputClass}
                    />
                </label>

                {error && (
                    <p role="alert" className="text-xs text-danger">
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !claimId || !title.trim()}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-text disabled:opacity-60"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Create task
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// Retain AlertCircle import (used by dashboard) to avoid unused warning when
// this file is analyzed alongside shared icon imports.
void AlertCircle;
