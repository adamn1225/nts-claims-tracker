"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  CheckCircle2,
  X,
  ExternalLink,
  Palette,
  Clock,
  Inbox,
} from "lucide-react";
import {
  coerceLandingConfig,
  getBrand,
  BLOCK_LABELS,
  type LandingConfig,
} from "@/lib/landing";

type PendingRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  profile_slug: string | null;
  landing_config: unknown;
  landing_submitted_at: string | null;
  config: LandingConfig;
};

export default function LandingReview() {
  // Landing columns aren't in the generated types yet.
  const supabase = createClient() as unknown as SupabaseClient;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAdminId(user?.id ?? null);

      const { data, error } = await supabase
        .from("brokers")
        .select(
          "id, first_name, last_name, email, profile_slug, landing_config, landing_submitted_at",
        )
        .eq("landing_status", "pending")
        .order("landing_submitted_at", { ascending: true });
      if (error) throw error;

      const mapped = (data ?? []).map((r) => {
        const row = r as Omit<PendingRow, "config">;
        return { ...row, config: coerceLandingConfig(row.landing_config) };
      });
      setRows(mapped);
    } catch (err) {
      console.error("Failed to load review queue:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(row: PendingRow) {
    setBusyId(row.id);
    try {
      const { error } = await supabase
        .from("brokers")
        .update({
          landing_config_approved: row.config,
          landing_status: "approved",
          landing_reviewed_at: new Date().toISOString(),
          landing_reviewed_by: adminId,
          landing_review_note: null,
        })
        .eq("id", row.id);
      if (error) throw error;

      // Notify the broker — they did not initiate this action.
      await supabase.from("notifications").insert({
        broker_id: row.id,
        type: "landing_approved",
        title: "Your landing page is live",
        message: row.profile_slug
          ? `Your landing page was approved and is now live at /rep/${row.profile_slug}.`
          : "Your landing page was approved and is now live.",
        link_url: row.profile_slug ? `/rep/${row.profile_slug}` : null,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
      });

      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      console.error("Approve failed:", err);
      alert("Could not approve this page. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function requestChanges(row: PendingRow) {
    setBusyId(row.id);
    try {
      const note = rejectNote.trim() || null;
      const { error } = await supabase
        .from("brokers")
        .update({
          landing_status: "rejected",
          landing_review_note: note,
          landing_reviewed_at: new Date().toISOString(),
          landing_reviewed_by: adminId,
        })
        .eq("id", row.id);
      if (error) throw error;

      // Notify the broker with the reviewer's feedback.
      await supabase.from("notifications").insert({
        broker_id: row.id,
        type: "landing_changes_requested",
        title: "Landing page changes requested",
        message: note
          ? `An admin requested changes to your landing page: ${note}`
          : "An admin requested changes to your landing page. Please update it and re-submit for review.",
        link_url: `/dashboard/brokers/${row.id}`,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
      });

      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setRejecting(null);
      setRejectNote("");
    } catch (err) {
      console.error("Request changes failed:", err);
      alert("Could not save your feedback. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          No pages awaiting review
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Broker landing page submissions will appear here for approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-slate-900">
          Landing pages — pending review
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {rows.length}
        </span>
      </div>

      {rows.map((row) => {
        const brand = getBrand(row.config.brand);
        const name =
          [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
        const visibleBlocks = row.config.blocks.filter((b) => b.visible);
        return (
          <div
            key={row.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className={`h-2 ${brand.bannerClass}`} />
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-white"
                      style={{ backgroundColor: brand.primary }}
                    >
                      {brand.name}
                    </span>
                    {row.landing_submitted_at && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(row.landing_submitted_at).toLocaleString()}
                      </span>
                    )}
                    {row.profile_slug && (
                      <a
                        href={`/rep/${row.profile_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-orange-600 hover:underline"
                      >
                        /rep/{row.profile_slug}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRejecting(rejecting === row.id ? null : row.id);
                      setRejectNote("");
                    }}
                    disabled={busyId === row.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Request changes
                  </button>
                  <button
                    onClick={() => approve(row)}
                    disabled={busyId === row.id || !row.profile_slug}
                    title={
                      !row.profile_slug
                        ? "Broker must set a public page URL first"
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve &amp; publish
                  </button>
                </div>
              </div>

              {/* Preview summary */}
              <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Hero tagline
                  </p>
                  <p className="text-sm text-slate-700">
                    {row.config.tagline?.trim() || (
                      <span className="italic text-slate-400">
                        {brand.defaultTagline} (brand default)
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Sections ({visibleBlocks.length})
                  </p>
                  {visibleBlocks.length === 0 ? (
                    <p className="text-sm italic text-slate-400">
                      No custom sections — standard profile only.
                    </p>
                  ) : (
                    <div className="mt-1 space-y-2">
                      {visibleBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="rounded-md border border-slate-200 bg-white p-2.5"
                        >
                          <p className="text-xs font-semibold text-slate-700">
                            {BLOCK_LABELS[block.type]}
                            <span className="ml-1.5 font-normal text-slate-400">
                              · {block.data.heading}
                            </span>
                          </p>
                          {block.type === "bio" && (
                            <p className="mt-1 line-clamp-3 text-xs text-slate-500">
                              {block.data.text || "(empty)"}
                            </p>
                          )}
                          {block.type === "testimonials" && (
                            <ul className="mt-1 space-y-1">
                              {block.data.items
                                .filter((i) => i.quote.trim())
                                .map((i, idx) => (
                                  <li
                                    key={idx}
                                    className="text-xs italic text-slate-500"
                                  >
                                    “{i.quote}” —{" "}
                                    {[i.name, i.company]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </li>
                                ))}
                            </ul>
                          )}
                          {block.type === "services" && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {block.data.items
                                .filter((i) => i.label.trim())
                                .map((i, idx) => (
                                  <span
                                    key={idx}
                                    className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                                  >
                                    {i.label}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Request-changes note */}
              {rejecting === row.id && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="mb-1 block text-xs font-medium text-amber-800">
                    What needs to change? (sent to the broker)
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Please remove the testimonial with no customer name."
                    className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber-400"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setRejecting(null)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => requestChanges(row)}
                      disabled={busyId === row.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {busyId === row.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Send feedback
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
