"use client";

import { useEffect, useState } from "react";
import {
  Wrench,
  Power,
  Save,
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Sparkles,
  Eye,
} from "lucide-react";
import MaintenanceScreen from "@/components/MaintenanceScreen";

interface MaintenanceState {
  maintenanceEnabled: boolean;
  message: string | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt?: string | null;
}

/**
 * Convert an ISO timestamp to a value usable by <input type="datetime-local">
 * (local wall-clock, no timezone suffix).
 */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a datetime-local value back to an ISO string (or null if empty). */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function MaintenanceControl() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState<"write" | "improve" | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/admin/maintenance", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data: MaintenanceState = await res.json();
      setEnabled(data.maintenanceEnabled);
      setMessage(data.message ?? "");
      setStartsAt(isoToLocalInput(data.startsAt));
      setEndsAt(isoToLocalInput(data.endsAt));
    } catch {
      setFeedback({ type: "error", text: "Could not load maintenance settings." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Keep a ticking clock so the "scheduled window active" status stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Maintenance is effectively active for users when the manual toggle is on,
  // OR when we're currently inside the scheduled window. This mirrors the
  // server-side logic in /api/maintenance.
  const startMs = startsAt ? new Date(startsAt).getTime() : NaN;
  const endMs = endsAt ? new Date(endsAt).getTime() : NaN;
  const scheduledActive =
    !Number.isNaN(startMs) &&
    now >= startMs &&
    (Number.isNaN(endMs) || now < endMs);
  const effectiveActive = enabled || scheduledActive;

  const flash = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const persist = async (overrides: Partial<MaintenanceState>) => {
    const body = {
      enabled: overrides.maintenanceEnabled ?? enabled,
      message: overrides.message !== undefined ? overrides.message : message,
      startsAt:
        overrides.startsAt !== undefined
          ? overrides.startsAt
          : localInputToIso(startsAt),
      endsAt:
        overrides.endsAt !== undefined
          ? overrides.endsAt
          : localInputToIso(endsAt),
    };

    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Save failed");
    }
    return res.json();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist({});
      flash("success", "Maintenance settings saved.");
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const next = !enabled;
    if (
      next &&
      !window.confirm(
        "Turn maintenance mode ON? All non-admin users will immediately see the maintenance page.",
      )
    ) {
      return;
    }
    setToggling(true);
    try {
      await persist({ maintenanceEnabled: next });
      setEnabled(next);
      flash(
        "success",
        next ? "Maintenance mode is now ON." : "Maintenance mode is now OFF.",
      );
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Could not toggle.");
    } finally {
      setToggling(false);
    }
  };

  // End an in-progress maintenance immediately — whether it was turned on
  // manually or activated by schedule. Clears the schedule window so it can't
  // instantly re-trigger, and flips the manual flag off.
  const handleEndNow = async () => {
    if (
      !window.confirm(
        "End maintenance now? Users will immediately regain access and the scheduled window will be cleared.",
      )
    ) {
      return;
    }
    setToggling(true);
    try {
      await persist({
        maintenanceEnabled: false,
        startsAt: null,
        endsAt: null,
      });
      setEnabled(false);
      setStartsAt("");
      setEndsAt("");
      flash("success", "Maintenance ended. Users have normal access.");
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Could not end.");
    } finally {
      setToggling(false);
    }
  };

  const runAi = async (mode: "write" | "improve") => {
    setAiBusy(mode);
    try {
      const res = await fetch("/api/ai/maintenance-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          currentMessage: message,
          startsAt: localInputToIso(startsAt),
          endsAt: localInputToIso(endsAt),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "AI request failed");
      if (data.message) setMessage(data.message);
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "AI request failed.");
    } finally {
      setAiBusy(null);
    }
  };

  const handleEmailAll = async () => {
    if (
      !window.confirm(
        "Email ALL active users an advance maintenance warning using the schedule above? Save your changes first if you just edited the times.",
      )
    ) {
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/admin/maintenance/notify", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send");
      flash(
        "success",
        `Warning emailed: ${data.sent} sent${data.failed ? `, ${data.failed} failed` : ""}.`,
      );
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Email failed.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading maintenance settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-orange-100 p-2">
          <Wrench className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Maintenance Mode
          </h2>
          <p className="text-sm text-slate-500">
            Take the app offline for everyone except admins, show a countdown,
            and email users an advance warning.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {feedback.text}
        </div>
      )}

      {/* Live status + toggle */}
      <div
        className={`flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
          effectiveActive
            ? "border-red-300 bg-red-50"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              effectiveActive ? "animate-pulse bg-red-500" : "bg-slate-400"
            }`}
          />
          <div>
            <p className="font-medium text-slate-900">
              {effectiveActive
                ? "Maintenance mode is ON"
                : "Maintenance mode is OFF"}
            </p>
            <p className="text-xs text-slate-500">
              {scheduledActive && !enabled
                ? "Active by schedule — non-admin users are seeing the maintenance page right now."
                : effectiveActive
                  ? "Non-admin users are seeing the maintenance page right now."
                  : "All users have normal access."}
            </p>
          </div>
        </div>
        <button
          onClick={effectiveActive ? handleEndNow : handleToggle}
          disabled={toggling}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
            effectiveActive
              ? "bg-slate-700 hover:bg-slate-800"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {toggling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {effectiveActive ? "End maintenance now" : "Turn ON maintenance"}
        </button>
      </div>

      {/* Message */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-slate-700">
            Message to users{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => runAi("write")}
              disabled={aiBusy !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-60"
            >
              {aiBusy === "write" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Write with AI
            </button>
            <button
              type="button"
              onClick={() => runAi("improve")}
              disabled={aiBusy !== null || !message.trim()}
              title={
                !message.trim() ? "Type a draft first to improve it" : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {aiBusy === "improve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Improve
            </button>
          </div>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="We're making some improvements and will be back shortly. Thanks for your patience!"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          AI uses your scheduled start/end times for context. Review before
          saving.
        </p>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Clock className="h-4 w-4 text-slate-400" /> Starts at
            <span className="font-normal text-slate-400">(auto-on)</span>
          </label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Clock className="h-4 w-4 text-slate-400" /> Expected back
            <span className="font-normal text-slate-400">(countdown)</span>
          </label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Times use your local timezone. Maintenance turns on automatically once
        the “Starts at” time arrives and turns off again at “Expected back” —
        no need to flip the toggle. “Starts at” also drives the advance warning
        banner, and “Expected back” drives the countdown on the maintenance
        page. Use the toggle above for an immediate, manual override. To end an
        active maintenance early, use &ldquo;End maintenance now&rdquo; above —
        it clears the schedule so it won&rsquo;t re-trigger.
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            Preview maintenance page
          </button>
          <button
            onClick={handleEmailAll}
            disabled={sendingEmail}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-60"
          >
            {sendingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Email all users a warning
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save settings
        </button>
      </div>

      {previewOpen && (
        <MaintenanceScreen
          message={message}
          endsAt={localInputToIso(endsAt)}
          preview
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
