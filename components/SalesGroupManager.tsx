"use client";

import { useEffect, useRef, useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    Loader2,
    Pencil,
    Plus,
    Trash2,
    UserMinus,
    UserPlus,
    Users,
    X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesGroup {
    id: string;
    name: string;
    description: string | null;
    groupType: "pip" | "general" | "top_performers" | "new_hire" | "custom";
    createdBy: string;
    creatorName: string | null;
    isActive: boolean;
    createdAt: string;
    memberIds: string[];
    memberCount: number;
}

interface TeamMember {
    id: string;
    first_name: string;
    last_name: string;
    office_location: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Called whenever groups are mutated so the dashboard can refetch */
    onGroupsChanged: (groups: SalesGroup[]) => void;
    allTeamMembers: TeamMember[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_TYPE_META: Record<
    SalesGroup["groupType"],
    { label: string; badgeClass: string }
> = {
    pip: { label: "PIP", badgeClass: "bg-red-100 text-red-700" },
    general: { label: "General", badgeClass: "bg-slate-100 text-slate-600" },
    top_performers: { label: "Top Performers", badgeClass: "bg-green-100 text-green-700" },
    new_hire: { label: "New Hire", badgeClass: "bg-blue-100 text-blue-700" },
    custom: { label: "Custom", badgeClass: "bg-purple-100 text-purple-700" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesGroupManager({
    isOpen,
    onClose,
    onGroupsChanged,
    allTeamMembers,
}: Props) {
    const [groups, setGroups] = useState<SalesGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // New group form state
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newType, setNewType] = useState<SalesGroup["groupType"]>("general");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Edit-in-place state
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editType, setEditType] = useState<SalesGroup["groupType"]>("general");
    const [editSaving, setEditSaving] = useState(false);

    // Add-member dropdown state  
    const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
    const [memberSearch, setMemberSearch] = useState("");
    const [addingTeamMemberId, setAddingTeamMemberId] = useState<string | null>(null);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);

    // ── Fetch groups ──────────────────────────────────────────────────────────
    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/sales-monitor/groups");
            const data = await res.json();
            if (res.ok) {
                setGroups(data.groups ?? []);
                onGroupsChanged(data.groups ?? []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, onClose]);

    // ── Create group ──────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!newName.trim()) { setFormError("Group name is required."); return; }
        setSaving(true);
        setFormError("");
        try {
            const res = await fetch("/api/sales-monitor/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, description: newDescription, groupType: newType }),
            });
            const data = await res.json();
            if (!res.ok) { setFormError(data.error || "Failed to create group."); return; }
            const updated = [data.group, ...groups];
            setGroups(updated);
            onGroupsChanged(updated);
            setNewName(""); setNewDescription(""); setNewType("general");
            setShowNewForm(false);
            setExpandedId(data.group.id);
        } finally {
            setSaving(false);
        }
    };

    // ── Update group ──────────────────────────────────────────────────────────
    const handleUpdate = async (groupId: string) => {
        setEditSaving(true);
        try {
            const res = await fetch(`/api/sales-monitor/groups/${groupId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, description: editDescription, groupType: editType }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to update group."); return; }
            const updated = groups.map((g) =>
                g.id === groupId ? { ...g, name: editName, description: editDescription, groupType: editType } : g,
            );
            setGroups(updated);
            onGroupsChanged(updated);
            setEditingId(null);
        } finally {
            setEditSaving(false);
        }
    };

    // ── Delete group ──────────────────────────────────────────────────────────
    const handleDelete = async (groupId: string) => {
        try {
            const res = await fetch(`/api/sales-monitor/groups/${groupId}`, { method: "DELETE" });
            if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to delete group."); return; }
            const updated = groups.filter((g) => g.id !== groupId);
            setGroups(updated);
            onGroupsChanged(updated);
            if (expandedId === groupId) setExpandedId(null);
        } finally {
            setDeletingId(null);
        }
    };

    // ── Add member ────────────────────────────────────────────────────────────
    const handleAddMember = async (groupId: string, teamMemberId: string) => {
        setAddingTeamMemberId(teamMemberId);
        try {
            const res = await fetch(`/api/sales-monitor/groups/${groupId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamMemberIds: [teamMemberId] }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to add member."); return; }
            const updated = groups.map((g) =>
                g.id === groupId
                    ? { ...g, memberIds: data.memberIds, memberCount: data.memberIds.length }
                    : g,
            );
            setGroups(updated);
            onGroupsChanged(updated);
            setMemberSearch("");
            setAddingToGroupId(null);
        } finally {
            setAddingTeamMemberId(null);
        }
    };

    // ── Remove member ─────────────────────────────────────────────────────────
    const handleRemoveMember = async (groupId: string, teamMemberId: string) => {
        try {
            const res = await fetch(`/api/sales-monitor/groups/${groupId}/members`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamMemberId }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to remove member."); return; }
            const updated = groups.map((g) =>
                g.id === groupId
                    ? { ...g, memberIds: data.memberIds, memberCount: data.memberIds.length }
                    : g,
            );
            setGroups(updated);
            onGroupsChanged(updated);
        } catch {
            // silently ignore
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getTeamMemberName = (teamMemberId: string) => {
        const b = allTeamMembers.find((b) => b.id === teamMemberId);
        return b ? `${b.first_name} ${b.last_name}` : teamMemberId.slice(0, 8) + "…";
    };

    const getAvailableTeamMembers = (group: SalesGroup) =>
        allTeamMembers
            .filter((b) => !group.memberIds.includes(b.id))
            .filter((b) => {
                if (!memberSearch) return true;
                const q = memberSearch.toLowerCase();
                return (
                    b.first_name.toLowerCase().includes(q) ||
                    b.last_name.toLowerCase().includes(q) ||
                    (b.office_location ?? "").toLowerCase().includes(q)
                );
            });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 pt-16 pr-4">
            <div
                ref={panelRef}
                className="flex h-[calc(100vh-5rem)] w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                            <Users className="h-4 w-4" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900">Sales Groups</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setShowNewForm(true); setEditingId(null); }}
                            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New Group
                        </button>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                    {/* New group form */}
                    {showNewForm && (
                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">New Group</p>
                            {formError && (
                                <p className="text-xs text-red-600">{formError}</p>
                            )}
                            <input
                                type="text"
                                placeholder="Group name *"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                                autoFocus
                            />
                            <input
                                type="text"
                                placeholder="Description (optional)"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                            />
                            <div className="relative">
                                <select
                                    value={newType}
                                    onChange={(e) => setNewType(e.target.value as SalesGroup["groupType"])}
                                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm focus:border-orange-400 focus:outline-none"
                                >
                                    {Object.entries(GROUP_TYPE_META).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreate}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Create Group
                                </button>
                                <button
                                    onClick={() => { setShowNewForm(false); setFormError(""); }}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center py-10 text-slate-400">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading groups...
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && groups.length === 0 && !showNewForm && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                            <p className="text-sm font-medium text-slate-500">No groups yet</p>
                            <p className="mt-1 text-xs text-slate-400">
                                Create a group to organize teamMembers (e.g. PIP cohort, new hires) and filter the dashboard.
                            </p>
                        </div>
                    )}

                    {/* Group list */}
                    {!loading && groups.map((group) => {
                        const meta = GROUP_TYPE_META[group.groupType] ?? GROUP_TYPE_META.general;
                        const isExpanded = expandedId === group.id;
                        const isEditing = editingId === group.id;
                        const isAddingMembers = addingToGroupId === group.id;
                        const memberTeamMembers = group.memberIds.map((id) => allTeamMembers.find((b) => b.id === id)).filter(Boolean) as TeamMember[];

                        return (
                            <div key={group.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                {/* Group header row */}
                                <div className="flex items-center gap-2 px-4 py-3">
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : group.id)}
                                        className="flex flex-1 items-center gap-2 text-left min-w-0"
                                    >
                                        {isExpanded
                                            ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                            : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                        }
                                        <span className="truncate text-sm font-semibold text-slate-800">{group.name}</span>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
                                            {meta.label}
                                        </span>
                                        <span className="shrink-0 text-xs text-slate-400">{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingId(isEditing ? null : group.id);
                                            setEditName(group.name);
                                            setEditDescription(group.description ?? "");
                                            setEditType(group.groupType);
                                            if (!isExpanded) setExpandedId(group.id);
                                        }}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                        title="Edit group"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingId(group.id)}
                                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                        title="Delete group"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Delete confirmation */}
                                {deletingId === group.id && (
                                    <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
                                        <p className="text-xs font-medium text-red-700">Delete "{group.name}"? This cannot be undone.</p>
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                onClick={() => handleDelete(group.id)}
                                                className="rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                                            >
                                                Yes, delete
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(null)}
                                                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Expanded body */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">

                                        {/* Edit form */}
                                        {isEditing && (
                                            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    placeholder="Group name"
                                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={editDescription}
                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                    placeholder="Description (optional)"
                                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                                                />
                                                <div className="relative">
                                                    <select
                                                        value={editType}
                                                        onChange={(e) => setEditType(e.target.value as SalesGroup["groupType"])}
                                                        className="w-full appearance-none rounded border border-slate-200 bg-white px-2 py-1.5 pr-7 text-sm focus:border-orange-400 focus:outline-none"
                                                    >
                                                        {Object.entries(GROUP_TYPE_META).map(([k, v]) => (
                                                            <option key={k} value={k}>{v.label}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-slate-400" />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleUpdate(group.id)}
                                                        disabled={editSaving}
                                                        className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                                                    >
                                                        {editSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                                                        Save
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Description */}
                                        {!isEditing && group.description && (
                                            <p className="text-xs text-slate-500">{group.description}</p>
                                        )}

                                        {/* Members list */}
                                        {memberTeamMembers.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">No members yet. Add teamMembers below.</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {memberTeamMembers.map((b) => (
                                                    <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                        <div>
                                                            <span className="text-sm font-medium text-slate-800">{b.first_name} {b.last_name}</span>
                                                            {b.office_location && (
                                                                <span className="ml-2 text-xs text-slate-400">{b.office_location}</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveMember(group.id, b.id)}
                                                            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                                                            title="Remove from group"
                                                        >
                                                            <UserMinus className="h-3.5 w-3.5" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {/* Add member area */}
                                        {isAddingMembers ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Search team members..."
                                                    value={memberSearch}
                                                    onChange={(e) => setMemberSearch(e.target.value)}
                                                    autoFocus
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                                                />
                                                <ul className="max-h-40 overflow-y-auto space-y-0.5">
                                                    {getAvailableTeamMembers(group).length === 0 ? (
                                                        <li className="px-2 py-2 text-xs text-slate-400">
                                                            {memberSearch ? "No matches." : "All active team members are already in this group."}
                                                        </li>
                                                    ) : getAvailableTeamMembers(group).map((b) => (
                                                        <li key={b.id}>
                                                            <button
                                                                onClick={() => handleAddMember(group.id, b.id)}
                                                                disabled={addingTeamMemberId === b.id}
                                                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-orange-50 disabled:opacity-50"
                                                            >
                                                                {addingTeamMemberId === b.id
                                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
                                                                    : <UserPlus className="h-3.5 w-3.5 text-slate-400" />
                                                                }
                                                                <span className="font-medium text-slate-800">{b.first_name} {b.last_name}</span>
                                                                {b.office_location && <span className="text-xs text-slate-400">{b.office_location}</span>}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <button onClick={() => { setAddingToGroupId(null); setMemberSearch(""); }} className="text-xs text-slate-400 hover:text-slate-600">
                                                    Close
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setAddingToGroupId(group.id)}
                                                className="flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-700"
                                            >
                                                <UserPlus className="h-3.5 w-3.5" />
                                                Add teamMember to group
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
