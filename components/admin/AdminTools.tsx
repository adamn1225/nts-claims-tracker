"use client";

/**
 * AdminTools
 * ---------------------------------------------------------------------------
 * Lightweight admin utility panel. Lives on its own tab inside the Admin
 * Dashboard so it never appears in teamMember-facing UI. Each utility is an
 * accordion section so the panel scales as more one-off ops tools get
 * added without cluttering the page.
 *
 * Current tools:
 *   1. Reset Kanban Columns to Defaults (per-teamMember or all team members)
 *
 * Add new tools by appending another `<ToolSection>` below.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import {
  Wrench,
  ChevronDown,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Reusable accordion section
// ---------------------------------------------------------------------------

type ToolSectionProps = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function ToolSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: ToolSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-200 bg-slate-50/50 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool 1: Reset Kanban Columns to Defaults
// ---------------------------------------------------------------------------

type TeamMemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

function ResetColumnsTool() {
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(true);
  const [scope, setScope] = useState<"one" | "all">("one");
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, email")
        .order("first_name", { ascending: true });
      if (error) {
        console.error("Failed to load team members for reset tool:", error);
        setTeamMembers([]);
      } else {
        setTeamMembers(data ?? []);
      }
      setLoadingTeamMembers(false);
    };
    load();
  }, []);

  const selectedTeamMember = teamMembers.find((b) => b.id === selectedTeamMemberId);

  const displayName = (b: TeamMemberOption) => {
    const first = b.first_name?.trim() ?? "";
    const last = b.last_name?.trim() ?? "";
    const full = `${first} ${last}`.trim();
    return full || b.email;
  };

  const canSubmit =
    !submitting && (scope === "all" || (scope === "one" && !!selectedTeamMemberId));

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          teamMemberId: scope === "one" ? selectedTeamMemberId : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({
          kind: "error",
          message: json?.error ?? `Request failed with status ${res.status}`,
        });
      } else {
        const who =
          scope === "all"
            ? `all ${json.resetCount} user${json.resetCount === 1 ? "" : "s"}`
            : selectedTeamMember
              ? displayName(selectedTeamMember)
              : "the selected user";
        setResult({
          kind: "success",
          message: `Reset ${json.columnsPerTeamMember ?? 5} default columns for ${who}. They may need to refresh their board.`,
        });
        setConfirming(false);
      }
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">What this does</p>
        <p className="mt-1">
          Deletes the selected user&apos;s custom Kanban columns and re-seeds
          the CEO&apos;s 5 defaults: <strong>Claim Started</strong>,{" "}
          <strong>Processing Claim</strong>, <strong>Claim Denied</strong>,{" "}
          <strong>Claim Awaiting Payment</strong>, <strong>Claim Closed</strong>.
          The protected <strong>Inbox</strong> column is always present and is
          not affected. Any claims sitting in deleted columns fall back to the
          Inbox — no claim data is lost.
        </p>
      </div>

      {/* Scope toggle */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setScope("one");
            setResult(null);
            setConfirming(false);
          }}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            scope === "one"
              ? "border-accent bg-accent/10 text-accent"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          <Users className="mr-2 inline h-3.5 w-3.5" />
          Single user
        </button>
        <button
          type="button"
          onClick={() => {
            setScope("all");
            setResult(null);
            setConfirming(false);
          }}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            scope === "all"
              ? "border-danger bg-danger/10 text-danger"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          <AlertTriangle className="mr-2 inline h-3.5 w-3.5" />
          All users
        </button>
      </div>

      {/* TeamMember selector (single-user mode only) */}
      {scope === "one" && (
        <div>
          <label
            htmlFor="reset-columns-teamMember"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Team member
          </label>
          <select
            id="reset-columns-teamMember"
            value={selectedTeamMemberId}
            onChange={(e) => {
              setSelectedTeamMemberId(e.target.value);
              setResult(null);
              setConfirming(false);
            }}
            disabled={loadingTeamMembers}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">
              {loadingTeamMembers ? "Loading users…" : "Select a team member…"}
            </option>
            {teamMembers.map((b) => (
              <option key={b.id} value={b.id}>
                {displayName(b)} — {b.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action */}
      {!confirming ? (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setConfirming(true);
          }}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to default columns
        </button>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            {scope === "all"
              ? `Reset columns for ALL ${teamMembers.length} users?`
              : `Reset columns for ${
                  selectedTeamMember ? displayName(selectedTeamMember) : "this user"
                }?`}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Their existing custom columns will be deleted and replaced with the
            5 defaults. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {submitting ? "Resetting…" : "Yes, reset now"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            result.kind === "success"
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {result.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{result.message}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

export default function AdminTools() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Admin Control Panel
          </h2>
          <p className="text-xs text-slate-500">
            One-off operational utilities. Each tool is collapsed by default to
            keep the page calm — expand to use.
          </p>
        </div>
      </div>

      <ToolSection
        id="reset-columns"
        title="Reset Kanban columns to defaults"
        description="Wipe a user's custom columns and re-seed the CEO's 5 defaults. Optional 'all users' mode."
        icon={<RotateCcw className="h-4 w-4" />}
        defaultOpen
      >
        <ResetColumnsTool />
      </ToolSection>

      {/* Add new <ToolSection> blocks here as more admin utilities are built. */}
    </div>
  );
}
