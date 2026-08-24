"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Circle,
    Clock,
    Loader2,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
    User,
    X,
} from "lucide-react";

// Kept in sync with the `task_type` / `task_priority` / `task_status` enums in
// migration 20260620000004_claim_activity.sql.
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

type ProfileRef = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
};

export type TaskAssignee = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    role: string | null;
    office_location: string | null;
};

type ClaimTask = {
    id: string;
    claim_id: string;
    template_id: string | null;
    type: TaskTypeValue;
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_at: string | null;
    assigned_to: string | null;
    completed_at: string | null;
    completion_notes: string | null;
    created_at: string;
    updated_at: string;
    creator: ProfileRef | null;
    assigned: ProfileRef | null;
};

function typeLabel(t: string) {
    return TASK_TYPES.find((x) => x.value === t)?.label ?? t;
}

function priorityLabel(p: string) {
    return PRIORITIES.find((x) => x.value === p)?.label ?? p;
}

function personName(p: ProfileRef | null | undefined): string {
    if (!p) return "";
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    return name || p.email || "";
}

function fmtDue(dueAt: string | null): string {
    if (!dueAt) return "No due date";
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return "No due date";
    return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function isOverdue(task: ClaimTask): boolean {
    if (!task.due_at) return false;
    if (task.status === "completed" || task.status === "cancelled") return false;
    return new Date(task.due_at).getTime() < Date.now();
}

// Build an ISO string from local date + time so the timestamptz column stores
// the wall-clock time the user picked (avoids UTC date-shift surprises).
function toDueAt(date: string, time: string | null): string | null {
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh = 9, mm = 0] = (time ?? "09:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm).toISOString();
}

function splitDueAt(dueAt: string | null): { date: string; time: string } {
    if (!dueAt) return { date: "", time: "" };
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { date, time };
}

function priorityTone(p: TaskPriority): string {
    switch (p) {
        case "critical":
            return "bg-danger/10 text-danger";
        case "high":
            return "bg-primary/10 text-primary-text";
        case "low":
            return "bg-slate-100 text-slate-600";
        default:
            return "bg-info/10 text-info-text";
    }
}

export interface ClaimTasksPanelProps {
    claimId: string;
    canEdit: boolean;
    assignableUsers: TaskAssignee[];
}

/**
 * ClaimTasksPanel — the per-claim Tasks section.
 *
 * Lists claim-scoped tasks grouped by status, with inline create/edit,
 * complete/reopen, reassign, and delete. Backed by /api/claims/:id/tasks.
 */
export default function ClaimTasksPanel({
    claimId,
    canEdit,
    assignableUsers,
}: ClaimTasksPanelProps) {
    const [tasks, setTasks] = useState<ClaimTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: "",
        type: "follow_up_carrier" as TaskTypeValue,
        priority: "normal" as TaskPriority,
        dueDate: "",
        dueTime: "",
        assignee: "" as string,
        description: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/claims/${claimId}/tasks`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Failed to load tasks");
            setTasks(json.tasks ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [claimId]);

    useEffect(() => {
        load();
    }, [load]);

    const { outstanding, completed, cancelled } = useMemo(() => {
        const sort = (a: ClaimTask, b: ClaimTask) => {
            const overdueA = isOverdue(a) ? 0 : 1;
            const overdueB = isOverdue(b) ? 0 : 1;
            if (overdueA !== overdueB) return overdueA - overdueB;
            if (a.due_at && b.due_at)
                return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
            if (a.due_at) return -1;
            if (b.due_at) return 1;
            return 0;
        };
        return {
            outstanding: tasks
                .filter((t) => ["open", "in_progress", "blocked"].includes(t.status))
                .sort(sort),
            completed: tasks.filter((t) => t.status === "completed"),
            cancelled: tasks.filter((t) => t.status === "cancelled"),
        };
    }, [tasks]);

    const resetForm = useCallback(() => {
        setForm({
            title: "",
            type: "follow_up_carrier",
            priority: "normal",
            dueDate: "",
            dueTime: "",
            assignee: "",
            description: "",
        });
        setEditingId(null);
    }, []);

    const openCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const openEdit = (task: ClaimTask) => {
        const { date, time } = splitDueAt(task.due_at);
        setForm({
            title: task.title,
            type: task.type,
            priority: task.priority,
            dueDate: date,
            dueTime: time,
            assignee: task.assigned_to ?? "",
            description: task.description ?? "",
        });
        setEditingId(task.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        const payload = {
            title: form.title.trim(),
            type: form.type,
            priority: form.priority,
            description: form.description.trim() || null,
            due_at: toDueAt(form.dueDate, form.dueTime || null),
            assigned_to: form.assignee || null,
        };
        try {
            const res = await fetch(`/api/claims/${claimId}/tasks`, {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Failed to save task");
            resetForm();
            setShowForm(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    const toggleComplete = async (task: ClaimTask) => {
        const next = task.status === "completed" ? "open" : "completed";
        try {
            const res = await fetch(`/api/claims/${claimId}/tasks`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: task.id, status: next }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Update failed");
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleDelete = async (task: ClaimTask) => {
        if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(
                `/api/claims/${claimId}/tasks?task_id=${encodeURIComponent(task.id)}`,
                { method: "DELETE" },
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Delete failed");
            if (editingId === task.id) {
                resetForm();
                setShowForm(false);
            }
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const inputClass =
        "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        Tasks ({outstanding.length} open)
                    </h2>
                    <p className="text-xs text-slate-500">
                        Assign follow-ups and checklist items for this claim.
                    </p>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={showForm ? () => setShowForm(false) : openCreate}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text"
                    >
                        {showForm ? (
                            <>
                                <X className="h-3.5 w-3.5" /> Cancel
                            </>
                        ) : (
                            <>
                                <Plus className="h-3.5 w-3.5" /> New Task
                            </>
                        )}
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-3 whitespace-pre-line rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                    {error}
                </div>
            )}

            {showForm && canEdit && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
                >
                    <label className="text-xs sm:col-span-2">
                        <span className="mb-1 block font-medium text-slate-700">Title</span>
                        <input
                            type="text"
                            required
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="e.g., Follow up with carrier on repair estimate"
                            className={inputClass}
                        />
                    </label>
                    <label className="text-xs">
                        <span className="mb-1 block font-medium text-slate-700">Type</span>
                        <select
                            value={form.type}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, type: e.target.value as TaskTypeValue }))
                            }
                            className={inputClass}
                        >
                            {TASK_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs">
                        <span className="mb-1 block font-medium text-slate-700">
                            Priority
                        </span>
                        <select
                            value={form.priority}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
                            }
                            className={inputClass}
                        >
                            {PRIORITIES.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs">
                        <span className="mb-1 block font-medium text-slate-700">
                            Due date
                        </span>
                        <input
                            type="date"
                            value={form.dueDate}
                            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                            className={inputClass}
                        />
                    </label>
                    <label className="text-xs">
                        <span className="mb-1 block font-medium text-slate-700">Time</span>
                        <input
                            type="time"
                            value={form.dueTime}
                            onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                            className={inputClass}
                        />
                    </label>
                    <label className="text-xs sm:col-span-2">
                        <span className="mb-1 block font-medium text-slate-700">
                            Assign to
                        </span>
                        <select
                            value={form.assignee}
                            onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                            className={inputClass}
                        >
                            <option value="">Unassigned (queue)</option>
                            {assignableUsers.map((u) => {
                                const name =
                                    `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
                                    u.email ||
                                    "Unnamed";
                                return (
                                    <option key={u.id} value={u.id}>
                                        {name}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label className="text-xs sm:col-span-2">
                        <span className="mb-1 block font-medium text-slate-700">
                            Notes
                        </span>
                        <textarea
                            value={form.description}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, description: e.target.value }))
                            }
                            rows={2}
                            placeholder="Optional details…"
                            className={inputClass}
                        />
                    </label>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                resetForm();
                            }}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !form.title.trim()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-text disabled:opacity-50"
                        >
                            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                            {editingId ? "Save changes" : "Create task"}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
            ) : tasks.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">
                    No tasks yet for this claim.
                </p>
            ) : (
                <div className="space-y-4">
                    <TaskGroup
                        title="Outstanding"
                        tasks={outstanding}
                        canEdit={canEdit}
                        onToggle={toggleComplete}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        emptyNote="No open tasks."
                    />
                    {completed.length > 0 && (
                        <TaskGroup
                            title="Completed"
                            tasks={completed}
                            canEdit={canEdit}
                            onToggle={toggleComplete}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                        />
                    )}
                    {cancelled.length > 0 && (
                        <TaskGroup
                            title="Cancelled"
                            tasks={cancelled}
                            canEdit={canEdit}
                            onToggle={toggleComplete}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

function TaskGroup({
    title,
    tasks,
    canEdit,
    onToggle,
    onEdit,
    onDelete,
    emptyNote,
}: {
    title: string;
    tasks: ClaimTask[];
    canEdit: boolean;
    onToggle: (task: ClaimTask) => void;
    onEdit: (task: ClaimTask) => void;
    onDelete: (task: ClaimTask) => void;
    emptyNote?: string;
}) {
    if (tasks.length === 0) {
        if (!emptyNote) return null;
        return (
            <p className="text-xs text-slate-400">
                {title}: {emptyNote}
            </p>
        );
    }
    return (
        <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {title} ({tasks.length})
            </h3>
            <ul className="space-y-2">
                {tasks.map((task) => {
                    const overdue = isOverdue(task);
                    const done = task.status === "completed";
                    const assignee = personName(task.assigned);
                    return (
                        <li
                            key={task.id}
                            className={`rounded-md border p-3 ${overdue
                                    ? "border-danger/30 bg-danger/5"
                                    : done
                                        ? "border-slate-200 bg-slate-50"
                                        : "border-slate-200 bg-white"
                                }`}
                        >
                            <div className="flex items-start gap-2.5">
                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => onToggle(task)}
                                        title={done ? "Reopen task" : "Mark complete"}
                                        className="mt-0.5 shrink-0 text-slate-400 hover:text-success"
                                    >
                                        {done ? (
                                            <RotateCcw className="h-4 w-4" />
                                        ) : (
                                            <Circle className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span
                                            className={`text-sm font-medium ${done ? "text-slate-500 line-through" : "text-slate-900"}`}
                                        >
                                            {task.title}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                            {typeLabel(task.type)}
                                        </span>
                                        <span
                                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${priorityTone(task.priority)}`}
                                        >
                                            {priorityLabel(task.priority)}
                                        </span>
                                    </div>
                                    {task.description && (
                                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
                                            {task.description}
                                        </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                        <span
                                            className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-danger" : ""}`}
                                        >
                                            {overdue ? (
                                                <AlertCircle className="h-3 w-3" />
                                            ) : (
                                                <Clock className="h-3 w-3" />
                                            )}
                                            {overdue ? "Overdue · " : ""}
                                            {fmtDue(task.due_at)}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {assignee || "Unassigned"}
                                        </span>
                                        {done && task.completed_at && (
                                            <span className="inline-flex items-center gap-1 text-success">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Completed{" "}
                                                {new Date(task.completed_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {canEdit && (
                                    <div className="flex shrink-0 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onEdit(task)}
                                            title="Edit task"
                                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-accent"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(task)}
                                            title="Delete task"
                                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-danger"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
