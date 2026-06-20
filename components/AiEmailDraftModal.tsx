"use client";

import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  MessageSquare,
  Briefcase,
  Coffee,
  Zap,
  Shield,
  TrendingUp,
  Wand2,
  Globe,
  Search,
  EyeOff,
  Building2,
  User,
  ChevronDown,
} from "lucide-react";
import Modal from "@/components/Modal";
import type { Database } from "@/lib/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

interface AiEmailDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

const EMAIL_TYPES = [
  { value: "introduction", label: "Cold Introduction" },
  { value: "follow_up_after_call", label: "Follow-Up After a Call" },
  { value: "check_in", label: "General Check-In" },
  { value: "win_back", label: "Win-Back / Re-Engagement" },
  { value: "quote_follow_up", label: "Quote Follow-Up" },
  { value: "rate_check_in", label: "Rate / Price Check-In" },
];

const TONES = [
  {
    value: "professional",
    label: "Professional",
    icon: Briefcase,
    desc: "Polished, business-like",
  },
  {
    value: "friendly",
    label: "Friendly",
    icon: Coffee,
    desc: "Warm, conversational",
  },
  {
    value: "urgent",
    label: "Urgent",
    icon: Zap,
    desc: "Direct, time-sensitive",
  },
];

const STYLE_MODES = [
  {
    value: "standard",
    label: "Standard",
    icon: Shield,
    desc: "Safe & effective",
  },
  {
    value: "strategic",
    label: "Strategic",
    icon: TrendingUp,
    desc: "Sharper positioning",
  },
  {
    value: "creative",
    label: "Creative",
    icon: Wand2,
    desc: "Distinctive hook",
  },
];

const RESEARCH_OPTIONS = [
  {
    value: "site_scan",
    label: "Site Scan",
    icon: Globe,
    desc: "Scrapes company website",
  },
  {
    value: "web_search",
    label: "Web Search",
    icon: Search,
    desc: "AI company research",
  },
];

const EXCLUDE_OPTIONS = [
  { value: "broker_notes", label: "Notes" },
  { value: "contact_log", label: "Contact History" },
  { value: "tasks", label: "Open Tasks" },
  { value: "estimated_value", label: "Est. Value" },
  { value: "last_contact_date", label: "Last Contact Date" },
];

export default function AiEmailDraftModal({
  isOpen,
  onClose,
  customer,
}: AiEmailDraftModalProps) {
  const [emailType, setEmailType] = useState("check_in");
  const [tone, setTone] = useState("professional");
  const [additionalContext, setAdditionalContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [editableSubject, setEditableSubject] = useState("");
  const [editableBody, setEditableBody] = useState("");
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [styleMode, setStyleMode] = useState("standard");
  const [researchSources, setResearchSources] = useState<Set<string>>(new Set());
  const [feedbackText, setFeedbackText] = useState("");

  const [excludeFields, setExcludeFields] = useState<Set<string>>(new Set());

  function toggleResearch(value: string) {
    setResearchSources((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleExclude(value: string) {
    setExcludeFields((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const [showFeedback, setShowFeedback] = useState(false);

  function handleClose() {
    setResult(null);
    setError(null);
    setAdditionalContext("");
    setCopiedSubject(false);
    setCopiedBody(false);
    setFeedbackText("");
    setShowFeedback(false);
    setResearchSources(new Set());
    setExcludeFields(new Set());
    onClose();
  }

  async function handleGenerate(refineFeedback?: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customer.id,
          emailType,
          tone,
          styleMode,
          researchSources: Array.from(researchSources),
          excludeFields: Array.from(excludeFields),
          additionalContext: additionalContext.trim() || undefined,
          ...(refineFeedback && result
            ? {
                previousDraft: { subject: editableSubject, body: editableBody },
                feedbackContext: refineFeedback,
              }
            : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate email draft.");
      }

      setResult(data);
      setEditableSubject(data.subject);
      setEditableBody(data.body);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!feedbackText.trim()) return;
    const feedback = feedbackText;
    setFeedbackText("");
    setShowFeedback(false);
    await handleGenerate(feedback);
  }

  async function copyToClipboard(text: string, field: "subject" | "body") {
    try {
      await navigator.clipboard.writeText(text);
      if (field === "subject") {
        setCopiedSubject(true);
        setTimeout(() => setCopiedSubject(false), 2000);
      } else {
        setCopiedBody(true);
        setTimeout(() => setCopiedBody(false), 2000);
      }
    } catch {
      // clipboard unavailable — fail silently
    }
  }

  const contactName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.contact_name ||
    customer.business_name;

  const modalTitle = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-orange-600 shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <span>AI Email Draft</span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="lg">
      <div className="flex flex-col">

        {/* Contact context strip */}
        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-sm font-medium text-slate-700">
              {customer.business_name || "—"}
            </span>
          </div>
          <div className="h-3.5 w-px shrink-0 bg-slate-200" />
          <div className="flex min-w-0 items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-sm text-slate-600">{contactName}</span>
          </div>
        </div>

        {/* Config panel */}
        {!result && (
          <div className="flex flex-col gap-5 p-6">

            {/* Email type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email Type
              </label>
              <div className="relative">
                <select
                  value={emailType}
                  onChange={(e) => setEmailType(e.target.value)}
                  disabled={loading}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm font-medium text-slate-800 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 disabled:opacity-50"
                >
                  {EMAIL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Tone + Style — 2-column grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tone */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tone
                </label>
                <div className="flex flex-col gap-1.5">
                  {TONES.map((t) => {
                    const Icon = t.icon;
                    const active = tone === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        disabled={loading}
                        onClick={() => setTone(t.value)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                          active
                            ? "border-orange-400 bg-orange-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-orange-500 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold leading-tight ${
                              active ? "text-orange-700" : "text-slate-700"
                            }`}
                          >
                            {t.label}
                          </p>
                          <p className="text-[10px] leading-tight text-slate-400">{t.desc}</p>
                        </div>
                        {active && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-orange-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Writing Style
                </label>
                <div className="flex flex-col gap-1.5">
                  {STYLE_MODES.map((s) => {
                    const Icon = s.icon;
                    const active = styleMode === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={loading}
                        onClick={() => setStyleMode(s.value)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                          active
                            ? "border-orange-400 bg-orange-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-orange-500 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold leading-tight ${
                              active ? "text-orange-700" : "text-slate-700"
                            }`}
                          >
                            {s.label}
                          </p>
                          <p className="text-[10px] leading-tight text-slate-400">{s.desc}</p>
                        </div>
                        {active && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-orange-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Research */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Research
                </label>
                <span className="text-[10px] text-slate-400">optional — adds latency</span>
              </div>
              {/* CRM is always included — show as a locked baseline chip */}
              <div className="mb-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500">
                  <Check className="h-3 w-3 text-slate-400" />
                  CRM Data
                </span>
                <span className="text-[10px] text-slate-400">always included</span>
              </div>
              {/* Additive toggles */}
              <div className="grid grid-cols-2 gap-2">
                {RESEARCH_OPTIONS.map((r) => {
                  const Icon = r.icon;
                  const active = researchSources.has(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={loading}
                      onClick={() => toggleResearch(r.value)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                        active
                          ? "border-orange-400 bg-orange-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold leading-tight ${
                            active ? "text-orange-700" : "text-slate-700"
                          }`}
                        >
                          {r.label}
                        </p>
                        <p className="text-[10px] leading-tight text-slate-400">{r.desc}</p>
                      </div>
                      <div
                        className={`h-4 w-4 shrink-0 rounded border ${
                          active
                            ? "border-orange-400 bg-orange-500"
                            : "border-slate-300 bg-white"
                        } flex items-center justify-center`}
                      >
                        {active && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {researchSources.has("site_scan") && !customer.website_url && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  No website URL on this profile — site scan will be skipped.
                </p>
              )}
            </div>

            {/* Exclude from context */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Exclude from Context
                <span className="ml-1.5 font-normal normal-case text-slate-400">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXCLUDE_OPTIONS.map((opt) => {
                  const active = excludeFields.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={loading}
                      onClick={() => toggleExclude(opt.value)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
                        active
                          ? "border-red-300 bg-red-50 text-red-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {active && <EyeOff className="h-3 w-3" />}
                      <span className={active ? "line-through" : ""}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional context */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Additional Context
                <span className="ml-1.5 font-normal normal-case text-slate-400">(optional)</span>
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                disabled={loading}
                rows={4}
                placeholder="e.g. We spoke last week about a flatbed move from Texas…"
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 disabled:opacity-50"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Generate button */}
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={loading}
              className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-linear-to-r from-orange-500 to-orange-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-500/30 disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {researchSources.has("site_scan") && researchSources.has("web_search")
                      ? "Researching & scanning…"
                      : researchSources.has("web_search")
                      ? "Researching company…"
                      : researchSources.has("site_scan")
                      ? "Scanning website…"
                      : "Analyzing context…"}
                  </span>
                  <span className="ml-1 animate-pulse text-orange-200">●●●</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Draft
                </>
              )}
            </button>

          </div>
        )}

        {/* Result panel */}
        {result && (
          <div className="flex flex-col">

            {/* Settings used — compact summary strip */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-6 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Used:</span>
              {[
                EMAIL_TYPES.find((e) => e.value === emailType)?.label,
                TONES.find((t) => t.value === tone)?.label,
                STYLE_MODES.find((s) => s.value === styleMode)?.label,
                ...RESEARCH_OPTIONS.filter((r) => researchSources.has(r.value)).map(
                  (r) => r.label,
                ),
              ]
                .filter(Boolean)
                .map((label) => (
                  <span
                    key={label}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                  >
                    {label}
                  </span>
                ))}
              <button
                type="button"
                onClick={() => setResult(null)}
                className="ml-auto text-[10px] font-medium text-orange-600 hover:text-orange-700 transition-colors"
              >
                Change settings
              </button>
            </div>

            {/* Email composer */}
            <div className="flex flex-col gap-0 divide-y divide-slate-100">

              {/* Subject */}
              <div className="px-6 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Subject
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editableSubject, "subject")}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                      copiedSubject
                        ? "bg-green-50 text-green-600"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    {copiedSubject ? (
                      <><Check className="h-3 w-3" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy</>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                />
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Body
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editableBody, "body")}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                      copiedBody
                        ? "bg-green-50 text-green-600"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    {copiedBody ? (
                      <><Check className="h-3 w-3" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy</>
                    )}
                  </button>
                </div>
                <textarea
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  rows={11}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                />
              </div>

            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Action bar */}
            <div className="border-t border-slate-100 px-6 py-4">
              {!showFeedback ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      {researchSources.size > 0 ? "Researching…" : "Regenerating…"}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowFeedback(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm transition-all hover:bg-orange-100 disabled:opacity-60"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Refine with Feedback
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-500" />
                    <label className="text-sm font-semibold text-orange-900">
                      What would you like to change?
                    </label>
                  </div>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={2}
                    placeholder="e.g. Make it shorter, use a stronger opener, remove the last paragraph…"
                    className="w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={loading || !feedbackText.trim()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all hover:from-orange-600 hover:to-orange-700 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Revising…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Revise Draft
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFeedback(false);
                        setFeedbackText("");
                      }}
                      disabled={loading}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </Modal>
  );
}
