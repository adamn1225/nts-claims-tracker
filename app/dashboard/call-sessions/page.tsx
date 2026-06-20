"use client";

/**
 * Call Sessions — broker-built power dialer with custom contact lists
 * separate from the main contacts table.
 *
 * Views:
 *   - hub        : pick a saved list, start ephemeral, manage prefs
 *   - list       : manage contacts in a saved list (add/import/edit/delete)
 *   - ephemeral  : build a one-off list in memory and start dialing
 *   - dial       : dial through the active session contact-by-contact
 *   - settings   : AI feedback preferences
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    PhoneCall, Phone, ListPlus, Upload, Settings as SettingsIcon, Trash2,
    ChevronLeft, ChevronRight, Plus, Search, Sparkles, ExternalLink, Pencil,
    CheckCircle2, XCircle, Voicemail, PhoneMissed, RotateCcw, Mail, MessageSquare,
    CalendarClock, Loader2, FileText, X, ArrowRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Contact = {
    id?: string;
    list_id?: string;
    name: string;
    company?: string | null;
    title?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
    industry?: string | null;
    tags?: string[] | null;
    notes?: string | null;
};

type CallList = {
    id: string;
    name: string;
    description: string | null;
    contact_count: number;
    updated_at: string;
};

type Preferences = {
    broker_id?: string;
    pre_call_brief: boolean;
    post_performance: boolean;
    post_tips: boolean;
    post_email_draft: boolean;
    post_sms_draft: boolean;
    post_suggest_followup: boolean;
    manual_advance: boolean;
    auto_advance_delay_sec: number;
};

type AiFeedback = {
    performance?: string;
    tips?: string[];
    email_draft?: { subject: string; body: string };
    sms_draft?: string;
    suggested_followup?: { when: string; summary: string };
};

type CallState = "idle" | "dialing" | "live" | "ended";

const OUTCOMES = [
    { value: "answered_talked", label: "Connected", icon: CheckCircle2, color: "text-emerald-300", ring: "ring-emerald-500" },
    { value: "left_voicemail", label: "Voicemail", icon: Voicemail, color: "text-blue-300", ring: "ring-blue-500" },
    { value: "no_answer", label: "No Answer", icon: PhoneMissed, color: "text-amber-300", ring: "ring-amber-500" },
    { value: "call_back_later", label: "Call Back", icon: RotateCcw, color: "text-violet-300", ring: "ring-violet-500" },
    { value: "not_interested", label: "Not Interested", icon: XCircle, color: "text-rose-300", ring: "ring-rose-500" },
] as const;

function formatPhone(phone: string | null | undefined): string {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return phone;
}

const DEFAULT_PREFS: Preferences = {
    pre_call_brief: true,
    post_performance: true,
    post_tips: true,
    post_email_draft: true,
    post_sms_draft: false,
    post_suggest_followup: true,
    manual_advance: true,
    auto_advance_delay_sec: 10,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CallSessionsPage() {
    type View = "hub" | "list" | "ephemeral" | "dial" | "settings";
    const [view, setView] = useState<View>("hub");

    const [lists, setLists] = useState<CallList[]>([]);
    const [listsLoading, setListsLoading] = useState(true);
    const [activeList, setActiveList] = useState<CallList | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

    // Dialing session state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionContacts, setSessionContacts] = useState<Contact[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);

    // ─── Load lists + prefs on mount ───────────────────────────────────────────
    useEffect(() => { void reloadLists(); void loadPrefs(); }, []);

    async function reloadLists() {
        setListsLoading(true);
        try {
            const res = await fetch("/api/call-sessions/lists");
            const data = await res.json();
            if (res.ok) setLists(data.lists ?? []);
        } finally { setListsLoading(false); }
    }

    async function loadPrefs() {
        const res = await fetch("/api/call-sessions/preferences");
        const data = await res.json();
        if (res.ok && data.preferences) setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
    }

    async function loadContacts(listId: string) {
        const res = await fetch(`/api/call-sessions/lists/${listId}/contacts`);
        const data = await res.json();
        if (res.ok) setContacts(data.contacts ?? []);
    }

    // ─── List actions ──────────────────────────────────────────────────────────
    async function createList(name: string) {
        const res = await fetch("/api/call-sessions/lists", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (res.ok) {
            await reloadLists();
            return data.list as CallList;
        }
        alert(data.error ?? "Failed to create list");
        return null;
    }

    async function deleteList(id: string) {
        if (!confirm("Delete this list and all its contacts?")) return;
        await fetch(`/api/call-sessions/lists/${id}`, { method: "DELETE" });
        void reloadLists();
    }

    async function openList(list: CallList) {
        setActiveList(list);
        await loadContacts(list.id);
        setView("list");
    }

    // ─── Start dialing ─────────────────────────────────────────────────────────
    async function startSavedSession(list: CallList) {
        await loadContacts(list.id);
        const res = await fetch("/api/call-sessions/sessions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "saved", listId: list.id }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        setSessionId(data.session.id);
        const fresh = await fetch(`/api/call-sessions/lists/${list.id}/contacts`).then((r) => r.json());
        setSessionContacts(fresh.contacts ?? []);
        setCurrentIdx(0);
        setActiveList(list);
        setView("dial");
    }

    async function startEphemeralSession(items: Contact[]) {
        if (items.length === 0) return;
        const res = await fetch("/api/call-sessions/sessions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "ephemeral", contactsSnapshot: items }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        setSessionId(data.session.id);
        setSessionContacts(items);
        setCurrentIdx(0);
        setActiveList(null);
        setView("dial");
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="bg-gray-950 text-white -mt-14 pt-14 lg:-mt-22 lg:pt-22 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Header view={view} onBack={() => setView("hub")} onSettings={() => setView("settings")} />

                {view === "hub" && (
                    <HubView
                        lists={lists}
                        loading={listsLoading}
                        onOpenList={openList}
                        onStartList={startSavedSession}
                        onDeleteList={deleteList}
                        onCreateList={async (name) => {
                            const l = await createList(name);
                            if (l) await openList(l);
                        }}
                        onStartEphemeral={() => setView("ephemeral")}
                    />
                )}

                {view === "list" && activeList && (
                    <ListView
                        list={activeList}
                        contacts={contacts}
                        onChanged={() => loadContacts(activeList.id)}
                        onStartDial={() => startSavedSession(activeList)}
                    />
                )}

                {view === "ephemeral" && (
                    <EphemeralView onStart={startEphemeralSession} />
                )}

                {view === "dial" && sessionContacts.length > 0 && (
                    <DialView
                        sessionId={sessionId!}
                        contacts={sessionContacts}
                        currentIdx={currentIdx}
                        setCurrentIdx={setCurrentIdx}
                        prefs={prefs}
                        onFinish={() => setView("hub")}
                    />
                )}

                {view === "settings" && (
                    <SettingsView prefs={prefs} onSaved={(p) => setPrefs(p)} />
                )}
            </div>
        </div>
    );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ view, onBack, onSettings }: { view: string; onBack: () => void; onSettings: () => void }) {
    const titles: Record<string, string> = {
        hub: "Call Sessions",
        list: "Manage List",
        ephemeral: "Quick Session",
        dial: "Active Session",
        settings: "AI Preferences",
    };
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                {view !== "hub" && (
                    <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10" aria-label="Back">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{titles[view]}</h1>
                    <p className="text-sm text-white/60">
                        {view === "hub" && "Build custom call lists and dial through them with AI coaching."}
                        {view === "list" && "Add, import, and edit contacts in this list."}
                        {view === "ephemeral" && "Build a one-off list in memory. Not saved after the session."}
                        {view === "dial" && "Profile-style cards with contact lookup and AI feedback."}
                        {view === "settings" && "Configure pre/post-call AI behavior."}
                    </p>
                </div>
            </div>
            {view !== "settings" && (
                <button
                    onClick={onSettings}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                >
                    <SettingsIcon className="w-4 h-4" /> AI Settings
                </button>
            )}
        </div>
    );
}

// ─── Hub view ────────────────────────────────────────────────────────────────

function HubView({
    lists, loading, onOpenList, onStartList, onDeleteList, onCreateList, onStartEphemeral,
}: {
    lists: CallList[];
    loading: boolean;
    onOpenList: (l: CallList) => void;
    onStartList: (l: CallList) => void;
    onDeleteList: (id: string) => void;
    onCreateList: (name: string) => void;
    onStartEphemeral: () => void;
}) {
    const [newName, setNewName] = useState("");
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium">Your Lists</h2>
                        <div className="flex items-center gap-2">
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="New list name…"
                                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newName.trim()) {
                                        onCreateList(newName.trim()); setNewName("");
                                    }
                                }}
                            />
                            <button
                                onClick={() => { if (newName.trim()) { onCreateList(newName.trim()); setNewName(""); } }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" /> Create
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-white/50"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : lists.length === 0 ? (
                        <div className="text-center py-12 text-white/50">
                            <ListPlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>No lists yet. Create one above to get started.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {lists.map((l) => (
                                <li key={l.id} className="py-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{l.name}</p>
                                        <p className="text-xs text-white/50">{l.contact_count} contact{l.contact_count === 1 ? "" : "s"}</p>
                                    </div>
                                    <button
                                        onClick={() => onOpenList(l)}
                                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm border border-white/10"
                                    >
                                        Manage
                                    </button>
                                    <button
                                        onClick={() => onStartList(l)}
                                        disabled={l.contact_count === 0}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <PhoneCall className="w-4 h-4" /> Start
                                    </button>
                                    <button onClick={() => onDeleteList(l.id)} className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-300" aria-label="Delete">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-linear-to-br from-orange-600/20 to-rose-600/10 border border-orange-500/30 rounded-2xl p-5">
                    <h3 className="text-lg font-medium mb-2">Quick Session</h3>
                    <p className="text-sm text-white/70 mb-4">
                        Build a one-off list in memory — paste, import, or add a few contacts and dial through them. Nothing is saved unless you choose to.
                    </p>
                    <button
                        onClick={onStartEphemeral}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 font-medium"
                    >
                        <Sparkles className="w-4 h-4" /> Start Quick Session
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── List view (manage contacts in a saved list) ─────────────────────────────

function ListView({
    list, contacts, onChanged, onStartDial,
}: {
    list: CallList;
    contacts: Contact[];
    onChanged: () => void;
    onStartDial: () => void;
}) {
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editing, setEditing] = useState<Contact | null>(null);
    const [filter, setFilter] = useState("");

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter((c) =>
            [c.name, c.company, c.phone, c.email, c.city, c.state, c.industry]
                .filter(Boolean).join(" ").toLowerCase().includes(q)
        );
    }, [contacts, filter]);

    async function handleDelete(id?: string) {
        if (!id || !confirm("Delete this contact?")) return;
        await fetch(`/api/call-sessions/contacts/${id}`, { method: "DELETE" });
        onChanged();
    }

    return (
        <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <h2 className="text-lg font-medium flex-1">{list.name} — {contacts.length} contact{contacts.length === 1 ? "" : "s"}</h2>
                    <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
                        <Plus className="w-4 h-4" /> Add Contact
                    </button>
                    <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
                        <Upload className="w-4 h-4" /> Import CSV
                    </button>
                    <button
                        onClick={onStartDial}
                        disabled={contacts.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40"
                    >
                        <PhoneCall className="w-4 h-4" /> Start Dialing
                    </button>
                </div>

                <div className="relative mb-3">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search contacts…"
                        className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-10 text-white/50">
                        <p>No contacts {filter ? "match your search" : "yet"}.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-white/50 text-left">
                                <tr>
                                    <th className="py-2 pr-3">Name</th>
                                    <th className="py-2 pr-3">Company</th>
                                    <th className="py-2 pr-3">Phone</th>
                                    <th className="py-2 pr-3">Email</th>
                                    <th className="py-2 pr-3">City/State</th>
                                    <th className="py-2 pr-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map((c) => (
                                    <tr key={c.id}>
                                        <td className="py-2 pr-3 font-medium">{c.name}</td>
                                        <td className="py-2 pr-3 text-white/70">{c.company || "—"}</td>
                                        <td className="py-2 pr-3 text-white/70">{formatPhone(c.phone) || "—"}</td>
                                        <td className="py-2 pr-3 text-white/70 truncate max-w-50">{c.email || "—"}</td>
                                        <td className="py-2 pr-3 text-white/70">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                                        <td className="py-2 pr-3 text-right">
                                            <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-white/10 rounded" aria-label="Edit">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-500/20 text-rose-300 rounded ml-1" aria-label="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAdd && (
                <ContactModal
                    contact={{ name: "" }}
                    onClose={() => setShowAdd(false)}
                    onSave={async (c) => {
                        await fetch(`/api/call-sessions/lists/${list.id}/contacts`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(c),
                        });
                        setShowAdd(false); onChanged();
                    }}
                />
            )}
            {editing && (
                <ContactModal
                    contact={editing}
                    onClose={() => setEditing(null)}
                    onSave={async (c) => {
                        await fetch(`/api/call-sessions/contacts/${editing.id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(c),
                        });
                        setEditing(null); onChanged();
                    }}
                />
            )}
            {showImport && (
                <ImportModal
                    listId={list.id}
                    onClose={() => setShowImport(false)}
                    onDone={() => { setShowImport(false); onChanged(); }}
                />
            )}
        </div>
    );
}

// ─── Ephemeral view ──────────────────────────────────────────────────────────

function EphemeralView({ onStart }: { onStart: (items: Contact[]) => void }) {
    const [items, setItems] = useState<Contact[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);

    function addContact(c: Contact) { setItems((prev) => [...prev, c]); setShowAdd(false); }
    function removeAt(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-lg font-medium flex-1">{items.length} contact{items.length === 1 ? "" : "s"} queued</h2>
                <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
                    <Plus className="w-4 h-4" /> Add Manually
                </button>
                <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
                    <Upload className="w-4 h-4" /> Paste CSV
                </button>
                <button
                    onClick={() => onStart(items)}
                    disabled={items.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40"
                >
                    <PhoneCall className="w-4 h-4" /> Start Dialing
                </button>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-10 text-white/50">
                    <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Build your queue. Add contacts manually or paste a CSV.</p>
                    <p className="text-xs mt-1">Nothing here is saved unless you start the session.</p>
                </div>
            ) : (
                <ul className="divide-y divide-white/5">
                    {items.map((c, i) => (
                        <li key={i} className="py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{c.name}</p>
                                <p className="text-xs text-white/50 truncate">{[c.company, formatPhone(c.phone), c.email].filter(Boolean).join(" • ")}</p>
                            </div>
                            <button onClick={() => removeAt(i)} className="p-2 hover:bg-rose-500/20 text-rose-300 rounded" aria-label="Remove">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {showAdd && (
                <ContactModal contact={{ name: "" }} onClose={() => setShowAdd(false)} onSave={addContact} />
            )}
            {showImport && (
                <EphemeralCsvModal
                    onClose={() => setShowImport(false)}
                    onParsed={(parsed) => { setItems((prev) => [...prev, ...parsed]); setShowImport(false); }}
                />
            )}
        </div>
    );
}

// ─── Dial view ───────────────────────────────────────────────────────────────

function DialView({
    sessionId, contacts, currentIdx, setCurrentIdx, prefs, onFinish,
}: {
    sessionId: string;
    contacts: Contact[];
    currentIdx: number;
    setCurrentIdx: (n: number) => void;
    prefs: Preferences;
    onFinish: () => void;
}) {
    const contact = contacts[currentIdx];
    const isLast = currentIdx >= contacts.length - 1;

    const [callState, setCallState] = useState<CallState>("idle");
    const [notes, setNotes] = useState("");
    const [outcome, setOutcome] = useState<string | null>(null);
    const [callId, setCallId] = useState<string | null>(null);

    const [brief, setBrief] = useState<string | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);
    const [feedback, setFeedback] = useState<AiFeedback | null>(null);
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [logId, setLogId] = useState<string | null>(null);
    const [logging, setLogging] = useState(false);

    const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset per-contact state when index changes
    useEffect(() => {
        setCallState("idle"); setNotes(""); setOutcome(null); setCallId(null);
        setBrief(null); setFeedback(null); setLogId(null);
        if (autoAdvanceTimer.current) { clearTimeout(autoAdvanceTimer.current); autoAdvanceTimer.current = null; }
        if (prefs.pre_call_brief) void loadBrief();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIdx]);

    const loadBrief = useCallback(async () => {
        setBriefLoading(true);
        try {
            const res = await fetch("/api/call-sessions/ai-brief", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contact }),
            });
            const data = await res.json();
            if (res.ok) setBrief(data.brief);
        } finally { setBriefLoading(false); }
    }, [contact]);

    async function dial() {
        if (!contact.phone) { alert("No phone number on this contact."); return; }
        setCallState("dialing");
        try {
            const res = await fetch("/api/goto/call", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: contact.phone }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error ?? "Failed to dial");
                setCallState("idle");
                return;
            }
            setCallId(data.callId ?? null);
            setCallState("live");
        } catch {
            setCallState("idle");
            alert("Network error placing call.");
        }
    }

    async function logCall(selectedOutcome: string) {
        setOutcome(selectedOutcome);
        setLogging(true);
        try {
            const res = await fetch("/api/call-sessions/call-logs", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    contact_id: contact.id ?? null,
                    contact_snapshot: contact,
                    outcome: selectedOutcome,
                    notes,
                    goto_call_id: callId,
                    pre_call_brief: brief,
                }),
            });
            const data = await res.json();
            if (res.ok) setLogId(data.log.id);
            setCallState("ended");
        } finally { setLogging(false); }
    }

    async function getFeedback() {
        setFeedbackLoading(true);
        try {
            const res = await fetch("/api/call-sessions/ai-feedback", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contact, notes, outcome }),
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback(data.feedback);
                // Save feedback onto the log
                if (logId) {
                    await fetch("/api/call-sessions/call-logs", {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: logId, ai_feedback: data.feedback }),
                    });
                }
            } else {
                alert(data.error ?? "Failed to get AI feedback");
            }
        } finally { setFeedbackLoading(false); }
    }

    function advance() {
        if (autoAdvanceTimer.current) { clearTimeout(autoAdvanceTimer.current); autoAdvanceTimer.current = null; }
        if (isLast) { void endSession(); return; }
        setCurrentIdx(currentIdx + 1);
    }

    async function endSession() {
        await fetch("/api/call-sessions/sessions", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: sessionId, ended_at: new Date().toISOString() }),
        });
        onFinish();
    }

    // Auto-advance if configured
    useEffect(() => {
        if (callState !== "ended") return;
        if (prefs.manual_advance) return;
        autoAdvanceTimer.current = setTimeout(advance, Math.max(2, prefs.auto_advance_delay_sec) * 1000);
        return () => {
            if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callState]);

    return (
        <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-3 text-sm text-white/60">
                <span>Contact {currentIdx + 1} of {contacts.length}</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${((currentIdx + 1) / contacts.length) * 100}%` }} />
                </div>
                <button onClick={endSession} className="text-rose-300 hover:text-rose-200 text-xs">End Session</button>
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
                {/* Profile card */}
                <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-start gap-4 mb-5">
                        <div className="w-14 h-14 rounded-full bg-linear-to-br from-orange-500 to-rose-500 flex items-center justify-center text-xl font-semibold">
                            {contact.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-semibold">{contact.name}</h2>
                            <p className="text-white/70 text-sm">
                                {[contact.title, contact.company].filter(Boolean).join(" • ") || "—"}
                            </p>
                            {(contact.city || contact.state) && (
                                <p className="text-white/50 text-xs mt-0.5">{[contact.city, contact.state].filter(Boolean).join(", ")}</p>
                            )}
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 text-sm mb-5">
                        <div className="bg-white/5 rounded-lg p-3">
                            <dt className="text-xs text-white/50 mb-1">Phone</dt>
                            <dd className="font-medium">{formatPhone(contact.phone) || "—"}</dd>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                            <dt className="text-xs text-white/50 mb-1">Email</dt>
                            <dd className="font-medium truncate">{contact.email || "—"}</dd>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                            <dt className="text-xs text-white/50 mb-1">Industry</dt>
                            <dd className="font-medium">{contact.industry || "—"}</dd>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                            <dt className="text-xs text-white/50 mb-1">Tags</dt>
                            <dd className="font-medium">{contact.tags?.length ? contact.tags.join(", ") : "—"}</dd>
                        </div>
                    </dl>

                    {contact.notes && (
                        <div className="bg-white/5 rounded-lg p-3 mb-5 text-sm">
                            <p className="text-xs text-white/50 mb-1">Saved notes</p>
                            <p className="text-white/80 whitespace-pre-wrap">{contact.notes}</p>
                        </div>
                    )}

                    {/* Call controls */}
                    <div className="space-y-3">
                        {callState === "idle" && (
                            <button onClick={dial} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium">
                                <PhoneCall className="w-5 h-5" /> Call {formatPhone(contact.phone) || "—"}
                            </button>
                        )}
                        {callState === "dialing" && (
                            <div className="w-full px-4 py-3 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-200 text-center">
                                <Loader2 className="w-5 h-5 inline-block animate-spin mr-2" /> Dialing…
                            </div>
                        )}
                        {callState === "live" && (
                            <div className="px-4 py-3 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 text-center">
                                <Phone className="w-5 h-5 inline-block mr-2" /> Call in progress
                            </div>
                        )}

                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notes from the call…"
                            rows={4}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />

                        {callState !== "idle" && callState !== "dialing" && (
                            <div>
                                <p className="text-xs text-white/50 mb-2">Log outcome</p>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {OUTCOMES.map((o) => {
                                        const Icon = o.icon;
                                        const selected = outcome === o.value;
                                        return (
                                            <button
                                                key={o.value}
                                                disabled={logging}
                                                onClick={() => logCall(o.value)}
                                                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-xs ${selected ? `bg-white/10 border-white/30 ring-2 ${o.ring}` : "bg-white/5 border-white/10 hover:bg-white/10"} ${o.color}`}
                                            >
                                                <Icon className="w-5 h-5" /> {o.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {callState === "ended" && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={getFeedback}
                                    disabled={feedbackLoading || (!notes.trim() && !callId)}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium disabled:opacity-50"
                                >
                                    {feedbackLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    AI Feedback
                                </button>
                                <button
                                    onClick={advance}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-medium"
                                >
                                    {isLast ? "Finish Session" : "Next Contact"} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI side panel */}
                <div className="lg:col-span-2 space-y-4">
                    {prefs.pre_call_brief && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="w-4 h-4 text-blue-300" />
                                <h3 className="font-medium">Pre-call brief</h3>
                                {briefLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40 ml-auto" />}
                            </div>
                            {brief ? (
                                <p className="text-sm text-white/80 whitespace-pre-wrap">{brief}</p>
                            ) : (
                                <p className="text-sm text-white/40">{briefLoading ? "Reviewing past calls…" : "No brief loaded."}</p>
                            )}
                        </div>
                    )}

                    {feedback && <FeedbackPanel feedback={feedback} />}

                    {/* Up-next */}
                    {!isLast && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-xs text-white/50 mb-1">Up next</p>
                            <p className="font-medium">{contacts[currentIdx + 1].name}</p>
                            <p className="text-xs text-white/60">{[contacts[currentIdx + 1].company, formatPhone(contacts[currentIdx + 1].phone)].filter(Boolean).join(" • ")}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Feedback panel ──────────────────────────────────────────────────────────

function FeedbackPanel({ feedback }: { feedback: AiFeedback }) {
    return (
        <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-300" />
                <h3 className="font-medium">AI feedback</h3>
            </div>

            {feedback.performance && (
                <section>
                    <h4 className="text-xs uppercase tracking-wide text-white/50 mb-1">Performance</h4>
                    <p className="text-sm text-white/80">{feedback.performance}</p>
                </section>
            )}

            {feedback.tips && feedback.tips.length > 0 && (
                <section>
                    <h4 className="text-xs uppercase tracking-wide text-white/50 mb-1">Tips</h4>
                    <ul className="text-sm text-white/80 list-disc list-inside space-y-1">
                        {feedback.tips.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                </section>
            )}

            {feedback.email_draft && (
                <section>
                    <h4 className="text-xs uppercase tracking-wide text-white/50 mb-1 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> Email draft
                    </h4>
                    <p className="text-xs text-white/60 mb-1">Subject: {feedback.email_draft.subject}</p>
                    <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans bg-black/30 rounded p-2">{feedback.email_draft.body}</pre>
                    <button
                        onClick={() => navigator.clipboard.writeText(`Subject: ${feedback.email_draft!.subject}\n\n${feedback.email_draft!.body}`)}
                        className="mt-2 text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                    >
                        Copy
                    </button>
                </section>
            )}

            {feedback.sms_draft && (
                <section>
                    <h4 className="text-xs uppercase tracking-wide text-white/50 mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> SMS draft
                    </h4>
                    <p className="text-sm text-white/80 bg-black/30 rounded p-2">{feedback.sms_draft}</p>
                    <button
                        onClick={() => navigator.clipboard.writeText(feedback.sms_draft!)}
                        className="mt-2 text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                    >
                        Copy
                    </button>
                </section>
            )}

            {feedback.suggested_followup && (
                <section>
                    <h4 className="text-xs uppercase tracking-wide text-white/50 mb-1 flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" /> Suggested follow-up
                    </h4>
                    <p className="text-sm text-white/80">
                        <span className="text-emerald-300 font-medium">{feedback.suggested_followup.when.replace(/_/g, " ")}</span>
                        {" — "}{feedback.suggested_followup.summary}
                    </p>
                </section>
            )}
        </div>
    );
}

// ─── Settings view ───────────────────────────────────────────────────────────

function SettingsView({ prefs, onSaved }: { prefs: Preferences; onSaved: (p: Preferences) => void }) {
    const [local, setLocal] = useState<Preferences>(prefs);
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        try {
            const res = await fetch("/api/call-sessions/preferences", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(local),
            });
            const data = await res.json();
            if (res.ok) onSaved({ ...DEFAULT_PREFS, ...data.preferences });
        } finally { setSaving(false); }
    }

    function Toggle({ field, label, hint }: { field: keyof Preferences; label: string; hint?: string }) {
        const value = Boolean(local[field]);
        return (
            <label className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
                <div>
                    <p className="font-medium text-sm">{label}</p>
                    {hint && <p className="text-xs text-white/50 mt-0.5">{hint}</p>}
                </div>
                <button
                    type="button"
                    onClick={() => setLocal({ ...local, [field]: !value })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-orange-600" : "bg-white/10"}`}
                >
                    <span className={`inline-block h-4 w-4 bg-white rounded-full transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
                </button>
            </label>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-lg font-medium mb-3">Pre-call</h2>
                <Toggle field="pre_call_brief" label="Generate pre-call brief" hint="AI summarizes prior call history for the contact before you dial." />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-lg font-medium mb-3">Post-call AI feedback</h2>
                <Toggle field="post_performance" label="Performance analysis" hint="What went well and what could improve." />
                <Toggle field="post_tips" label="Coaching tips" hint="Concrete suggestions for the next call." />
                <Toggle field="post_email_draft" label="Follow-up email draft" />
                <Toggle field="post_sms_draft" label="Follow-up SMS draft" />
                <Toggle field="post_suggest_followup" label="Suggest follow-up timing" />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-lg font-medium mb-3">Session flow</h2>
                <Toggle field="manual_advance" label="Manual advance" hint="Require clicking ‘Next’ between contacts (recommended)." />
                {!local.manual_advance && (
                    <div className="pt-3">
                        <label className="text-sm">Auto-advance delay (seconds)
                            <input
                                type="number" min={2} max={120}
                                value={local.auto_advance_delay_sec}
                                onChange={(e) => setLocal({ ...local, auto_advance_delay_sec: Number(e.target.value) || 10 })}
                                className="block mt-1 w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                            />
                        </label>
                    </div>
                )}
            </div>

            <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-medium disabled:opacity-50"
            >
                {saving ? "Saving…" : "Save preferences"}
            </button>
        </div>
    );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function ContactModal({ contact, onClose, onSave }: { contact: Contact; onClose: () => void; onSave: (c: Contact) => void }) {
    const [form, setForm] = useState<Contact>({ ...contact });
    // Keep tags as a free-form string while editing so commas and spaces type naturally.
    // Parse to string[] only on save.
    const [tagsInput, setTagsInput] = useState<string>((contact.tags ?? []).join(", "));

    function set<K extends keyof Contact>(k: K, v: Contact[K]) { setForm((p) => ({ ...p, [k]: v })); }

    function handleSave() {
        const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
        onSave({ ...form, tags });
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-medium">{contact.id ? "Edit contact" : "Add contact"}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                    <Field label="Name *" className="col-span-2"><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" className={inputCls} /></Field>
                    <Field label="Company"><input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} placeholder="Acme Logistics" className={inputCls} /></Field>
                    <Field label="Title / Role"><input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Logistics Coordinator" className={inputCls} /></Field>
                    <Field label="Phone"><input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" className={inputCls} /></Field>
                    <Field label="Email"><input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="jane@acme.com" className={inputCls} /></Field>
                    <Field label="City"><input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Hollywood" className={inputCls} /></Field>
                    <Field label="State"><input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} placeholder="FL" className={inputCls} /></Field>
                    <Field label="Industry" className="col-span-2"><input value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value)} placeholder="Manufacturing, Retail, Construction…" className={inputCls} /></Field>
                    <Field label="Tags (comma separated)" className="col-span-2"><input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="hot-lead, follow-up, q2-target" className={inputCls} /></Field>
                    <Field label="Notes" className="col-span-2"><textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth remembering before the call…" className={`${inputCls} resize-none`} /></Field>
                </div>
                <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Cancel</button>
                    <button
                        onClick={() => { if (form.name.trim()) handleSave(); }}
                        disabled={!form.name.trim()}
                        className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-medium disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputCls = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <label className={`block ${className}`}>
            <span className="block text-xs text-white/60 mb-1">{label}</span>
            {children}
        </label>
    );
}

function ImportModal({ listId, onClose, onDone }: { listId: string; onClose: () => void; onDone: () => void }) {
    const [csv, setCsv] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!csv.trim()) return;
        setBusy(true);
        try {
            const res = await fetch("/api/call-sessions/import", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ listId, csv }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error); return; }
            alert(`Imported ${data.inserted} contact${data.inserted === 1 ? "" : "s"}.`);
            onDone();
        } finally { setBusy(false); }
    }

    async function loadFile(file: File) { setCsv(await file.text()); }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-medium">Import CSV</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3 text-sm">
                    <p className="text-xs text-white/60">
                        Headers (case-insensitive, any subset): name, company, title, phone, email, city, state, industry, tags, notes
                    </p>
                    <input
                        type="file" accept=".csv,text/csv"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); }}
                        className="block text-sm text-white/70"
                    />
                    <textarea
                        rows={10}
                        value={csv}
                        onChange={(e) => setCsv(e.target.value)}
                        placeholder="Paste CSV here…"
                        className={`${inputCls} resize-none font-mono text-xs`}
                    />
                </div>
                <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Cancel</button>
                    <button onClick={submit} disabled={busy || !csv.trim()} className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-medium disabled:opacity-50">
                        {busy ? "Importing…" : "Import"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EphemeralCsvModal({ onClose, onParsed }: { onClose: () => void; onParsed: (rows: Contact[]) => void }) {
    const [csv, setCsv] = useState("");

    function parseLine(line: string): string[] {
        const out: string[] = []; let cur = ""; let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (q) {
                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (ch === '"') q = false;
                else cur += ch;
            } else {
                if (ch === '"') q = true;
                else if (ch === ",") { out.push(cur); cur = ""; }
                else cur += ch;
            }
        }
        out.push(cur);
        return out.map((s) => s.trim());
    }

    const HEADER: Record<string, keyof Contact> = {
        name: "name", company: "company", title: "title", role: "title",
        phone: "phone", email: "email", city: "city", state: "state",
        industry: "industry", tags: "tags", notes: "notes",
    };

    function parse() {
        const lines = csv.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { alert("Need a header row and at least one data row."); return; }
        const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
        const rows: Contact[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseLine(lines[i]);
            const row: Contact = { name: "" };
            headers.forEach((h, idx) => {
                const f = HEADER[h]; if (!f) return;
                const v = cols[idx] ?? "";
                if (!v) return;
                if (f === "tags") row.tags = v.split(/[,|]/).map((t) => t.trim()).filter(Boolean);
                else (row as Record<string, unknown>)[f] = v;
            });
            if (row.name.trim()) rows.push(row);
        }
        if (rows.length === 0) { alert("No rows with a name column found."); return; }
        onParsed(rows);
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-medium">Paste CSV</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3 text-sm">
                    <p className="text-xs text-white/60">
                        Headers (any subset): name, company, title, phone, email, city, state, industry, tags, notes
                    </p>
                    <input
                        type="file" accept=".csv,text/csv"
                        onChange={async (e) => {
                            const f = e.target.files?.[0]; if (f) setCsv(await f.text());
                        }}
                        className="block text-sm text-white/70"
                    />
                    <textarea
                        rows={10}
                        value={csv}
                        onChange={(e) => setCsv(e.target.value)}
                        className={`${inputCls} resize-none font-mono text-xs`}
                        placeholder="name,company,phone,email&#10;Acme Logistics,Acme,555-1234,buyer@acme.com"
                    />
                </div>
                <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Cancel</button>
                    <button onClick={parse} disabled={!csv.trim()} className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-medium disabled:opacity-50">
                        Add to queue
                    </button>
                </div>
            </div>
        </div>
    );
}
