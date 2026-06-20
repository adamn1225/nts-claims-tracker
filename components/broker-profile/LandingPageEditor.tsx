"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  X,
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Send,
  Save,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import {
  LANDING_BRAND_LIST,
  ADDABLE_BLOCK_TYPES,
  BLOCK_LABELS,
  BLOCK_DESCRIPTIONS,
  LANDING_STATUS_LABELS,
  createBlock,
  getBrand,
  type LandingBrandId,
  type LandingBlock,
  type LandingBlockType,
  type LandingConfig,
  type Testimonial,
  type ServiceItem,
} from "@/lib/landing";

type Props = {
  brokerId: string;
  initialConfig: LandingConfig;
  initialStatus: string;
  reviewNote: string | null;
  profileSlug: string | null;
  onClose: () => void;
  onSaved: () => void;
};

// Brand selection is temporarily disabled — launching with a single brand (NTS).
// Flip this to true to re-enable the multi-brand picker once the team signs off.
const ENABLE_BRAND_PICKER = false;

export default function LandingPageEditor({
  brokerId,
  initialConfig,
  initialStatus,
  reviewNote,
  profileSlug,
  onClose,
  onSaved,
}: Props) {
  // New landing columns aren't in the generated types yet; use an untyped
  // client so writes compile before db:types is regenerated.
  const supabase = createClient() as unknown as SupabaseClient;

  const [brand, setBrand] = useState<LandingBrandId>(initialConfig.brand);
  const [tagline, setTagline] = useState(initialConfig.tagline ?? "");
  const [blocks, setBlocks] = useState<LandingBlock[]>(initialConfig.blocks);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBrand = useMemo(() => getBrand(brand), [brand]);

  function updateBlock(id: string, next: Partial<LandingBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...next } as LandingBlock) : b)),
    );
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function addBlock(type: LandingBlockType) {
    setBlocks((prev) => [...prev, createBlock(type)]);
  }

  function buildConfig(): LandingConfig {
    return { brand, tagline: tagline.trim(), blocks };
  }

  async function persist(nextStatus: "draft" | "pending") {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        landing_config: buildConfig(),
        landing_status: nextStatus,
      };
      if (nextStatus === "pending") {
        payload.landing_submitted_at = new Date().toISOString();
        payload.landing_review_note = null;
      }
      const { error: err } = await supabase
        .from("brokers")
        .update(payload)
        .eq("id", brokerId);
      if (err) throw err;
      setStatus(nextStatus);
      onSaved();
      if (nextStatus === "pending") onClose();
    } catch (err) {
      console.error("Landing save failed:", err);
      setError("Could not save your landing page. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Customize your landing page
            </h3>
            <p className="text-xs text-gray-500">
              Make it yours, then submit for a quick review.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <StatusBanner status={status} reviewNote={reviewNote} />

          {/* Brand picker — temporarily disabled (single-brand launch).
              Preserved for an upcoming team discussion; re-enable by setting
              ENABLE_BRAND_PICKER to true. */}
          {ENABLE_BRAND_PICKER && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-900">Brand</h4>
              <p className="mb-3 text-xs text-gray-500">
                Choose the brand your page represents.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {LANDING_BRAND_LIST.map((b) => {
                  const selected = brand === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBrand(b.id)}
                      className={`overflow-hidden rounded-xl border-2 text-left transition ${
                        selected
                          ? "border-gray-900 ring-2 ring-gray-900/10"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className={`h-12 ${b.bannerClass}`} />
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {b.name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {b.defaultTagline}
                          </p>
                        </div>
                        {selected && (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-gray-900" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tagline */}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">
              Hero tagline
            </h4>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder={activeBrand.defaultTagline}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
            <p className="mt-1 text-xs text-gray-400">
              Shown above your quote request form. Leave blank to use the brand
              default.
            </p>
          </section>

          {/* Blocks */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">
                Content sections
              </h4>
              <span className="text-xs text-gray-400">
                {blocks.length} {blocks.length === 1 ? "section" : "sections"}
              </span>
            </div>

            {blocks.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                No custom sections yet. Add one below to tell your story.
              </p>
            )}

            <div className="space-y-3">
              {blocks.map((block, index) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                  accent={activeBrand.primary}
                  onChange={(next) => updateBlock(block.id, next)}
                  onMoveUp={() => moveBlock(index, -1)}
                  onMoveDown={() => moveBlock(index, 1)}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}
            </div>

            {/* Add buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              {ADDABLE_BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-900 hover:text-gray-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">
            {profileSlug ? (
              <>Your page: <span className="font-medium text-gray-600">/rep/{profileSlug}</span></>
            ) : (
              <span className="text-amber-600">
                Set a public page URL in “Edit profile” to go live.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => persist("draft")}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </button>
            <button
              onClick={() => persist("pending")}
              disabled={saving || !profileSlug}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Submit for review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  reviewNote,
}: {
  status: string;
  reviewNote: string | null;
}) {
  if (status === "pending") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Your page is <strong>pending review</strong>. An admin will approve it
          shortly. You can keep editing — re-submit to update your request.
        </span>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Your page is <strong>live</strong>. New edits will need another review
          before they appear publicly.
        </span>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Changes requested.</strong>{" "}
          {reviewNote
            ? reviewNote
            : "Please update your page and re-submit for review."}
        </span>
      </div>
    );
  }
  return null;
}

function BlockCard({
  block,
  isFirst,
  isLast,
  accent,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: LandingBlock;
  isFirst: boolean;
  isLast: boolean;
  accent: string;
  onChange: (next: Partial<LandingBlock>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <GripVertical className="h-4 w-4 text-gray-300" />
          {BLOCK_LABELS[block.type]}
          {!block.visible && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              Hidden
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onChange({ visible: !block.visible } as Partial<LandingBlock>)}
            title={block.visible ? "Hide section" : "Show section"}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {block.visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move up"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move down"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove section"
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <input
          type="text"
          value={block.data.heading}
          onChange={(e) =>
            onChange({
              data: { ...block.data, heading: e.target.value },
            } as Partial<LandingBlock>)
          }
          placeholder="Section heading"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-gray-900"
        />

        {block.type === "bio" && (
          <textarea
            value={block.data.text}
            onChange={(e) =>
              onChange({
                data: { ...block.data, text: e.target.value },
              } as Partial<LandingBlock>)
            }
            rows={4}
            maxLength={1200}
            placeholder="Tell customers your story — your experience, the lanes you know best, and what makes working with you different."
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        )}

        {block.type === "testimonials" && (
          <TestimonialsEditor
            items={block.data.items}
            accent={accent}
            onChange={(items) =>
              onChange({
                data: { ...block.data, items },
              } as Partial<LandingBlock>)
            }
          />
        )}

        {block.type === "services" && (
          <ServicesEditor
            items={block.data.items}
            accent={accent}
            onChange={(items) =>
              onChange({
                data: { ...block.data, items },
              } as Partial<LandingBlock>)
            }
          />
        )}

        <p className="text-[11px] text-gray-400">
          {BLOCK_DESCRIPTIONS[block.type]}
        </p>
      </div>
    </div>
  );
}

function TestimonialsEditor({
  items,
  accent,
  onChange,
}: {
  items: Testimonial[];
  accent: string;
  onChange: (items: Testimonial[]) => void;
}) {
  function update(i: number, patch: Partial<Testimonial>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-gray-200 bg-white p-2.5"
        >
          <textarea
            value={item.quote}
            onChange={(e) => update(i, { quote: e.target.value })}
            rows={2}
            maxLength={400}
            placeholder="“They got my oversize load delivered ahead of schedule…”"
            className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={item.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Customer name"
              className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-gray-900"
            />
            <input
              type="text"
              value={item.company}
              onChange={(e) => update(i, { company: e.target.value })}
              placeholder="Company"
              className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-gray-900"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { quote: "", name: "", company: "" }])}
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: accent }}
      >
        <Plus className="h-3.5 w-3.5" /> Add testimonial
      </button>
    </div>
  );
}

function ServicesEditor({
  items,
  accent,
  onChange,
}: {
  items: ServiceItem[];
  accent: string;
  onChange: (items: ServiceItem[]) => void;
}) {
  function update(i: number, patch: Partial<ServiceItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={item.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="RGN / Flatbed / Oversize…"
            className="w-40 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
          />
          <input
            type="text"
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Short description"
            className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { label: "", description: "" }])}
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: accent }}
      >
        <Plus className="h-3.5 w-3.5" /> Add service
      </button>
    </div>
  );
}
