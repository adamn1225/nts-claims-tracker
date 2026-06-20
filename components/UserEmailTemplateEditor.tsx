"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Info, Send, Copy, Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
  template_type: string;
  is_system: boolean;
}

const tokenHints = [
  "{{first_name}}",
  "{{last_name}}",
  "{{company}}",
  "{{broker_name}}",
  "{{broker_phone}}",
  "{{broker_email}}",
];

export default function UserEmailTemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Fetch only external templates (for customer outreach)
      const response = await fetch("/api/admin/email-templates?type=external");
      const data = await response.json();
      if (response.ok && data.templates) {
        setTemplates(data.templates);
        if (data.templates.length > 0 && !selectedId) {
          setSelectedId(data.templates[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      showMessage("error", "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const update = (patch: Partial<Template>) => {
    if (!selected) return;
    setTemplates((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, ...patch } : t)),
    );
  };

  const addNew = () => {
    const id = `new-${Date.now()}`;
    const t: Template = {
      id,
      name: "New Template",
      subject: "{{first_name}}, ...",
      body: "<p>Hi {{first_name}},</p><p>Write your message here...</p><p>Best,<br/>{{broker_name}}<br/>{{broker_phone}}</p>",
      description: "",
      template_type: "external",
      is_system: false,
    };
    setTemplates([t, ...templates]);
    setSelectedId(id);
  };

  const saveTemplate = async () => {
    if (!selected) return;

    setSaving(true);
    try {
      const isNew = selected.id.startsWith("new-");
      const url = "/api/admin/email-templates";
      const method = isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isNew ? undefined : selected.id,
          name: selected.name,
          subject: selected.subject,
          body: selected.body,
          description: selected.description,
          template_type: "external",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage("success", "Template saved successfully!");
        await loadTemplates();
        if (data.template) {
          setSelectedId(data.template.id);
        }
      } else {
        showMessage("error", data.error || "Failed to save template");
      }
    } catch (error: any) {
      showMessage("error", error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selected || selected.is_system) {
      showMessage("error", "Cannot delete system templates");
      return;
    }

    if (!confirm(`Delete "${selected.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/email-templates?id=${selected.id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        showMessage("success", "Template deleted");
        await loadTemplates();
      } else {
        showMessage("error", "Failed to delete template");
      }
    } catch (error) {
      showMessage("error", "Failed to delete template");
    }
  };

  const copyPreview = () => {
    if (!selected) return;

    const previewHtml = selected.body
      .replaceAll("{{first_name}}", "Alex")
      .replaceAll("{{last_name}}", "Johnson")
      .replaceAll("{{company}}", "Acme Corp")
      .replaceAll("{{broker_name}}", "Your Name")
      .replaceAll("{{broker_phone}}", "Your Phone")
      .replaceAll("{{broker_email}}", "your@email.com");

    navigator.clipboard.writeText(previewHtml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">External Email Templates</p>
            <p className="mt-1">
              Create templates for customer outreach. When you use a template on
              a customer page, it will auto-fill their information for easy
              copy/paste into your Outlook email.
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border p-3 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Editor Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            disabled={templates.length === 0}
          >
            {templates.length === 0 && <option value="">No templates</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_system ? "(System)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={addNew}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
          {selected && !selected.is_system && (
            <button
              onClick={deleteTemplate}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Info className="h-4 w-4" /> Use tokens: {tokenHints.join(", ")}
        </div>
      </div>

      {selected && (
        <>
          {/* Fields */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left Column - Editor */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Template Name
                </label>
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={selected.is_system}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="e.g., Initial Outreach, Follow-up"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Description (optional)
                </label>
                <input
                  value={selected.description || ""}
                  onChange={(e) => update({ description: e.target.value })}
                  disabled={selected.is_system}
                  placeholder="Brief description of when to use this template"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Subject Line
                </label>
                <input
                  value={selected.subject}
                  onChange={(e) => update({ subject: e.target.value })}
                  disabled={selected.is_system}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="{{first_name}}, quick question about {{company}}"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Email Body (HTML)
                </label>
                <textarea
                  value={selected.body}
                  onChange={(e) => update({ body: e.target.value })}
                  disabled={selected.is_system}
                  rows={14}
                  className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs leading-relaxed focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="<p>Hi {{first_name}},</p>&#10;<p>Your message here...</p>&#10;<p>Best,<br/>{{broker_name}}</p>"
                />
              </div>
              <div className="flex gap-2">
                {!selected.is_system && (
                  <button
                    onClick={saveTemplate}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Template"}
                  </button>
                )}
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-medium text-slate-700">
                  Preview (with sample data)
                </span>
                <button
                  onClick={copyPreview}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  title="Copy preview HTML"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="p-4">
                <div className="mb-3 border-b border-slate-200 pb-2">
                  <strong className="text-xs font-medium text-slate-500">
                    Subject:
                  </strong>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selected.subject
                      .replaceAll("{{first_name}}", "Alex")
                      .replaceAll("{{last_name}}", "Johnson")
                      .replaceAll("{{company}}", "Acme Corp")
                      .replaceAll("{{broker_name}}", "Your Name")}
                  </p>
                </div>
                <div
                  className="text-sm leading-6 text-slate-800"
                  dangerouslySetInnerHTML={{
                    __html: selected.body
                      .replaceAll("{{first_name}}", "Alex")
                      .replaceAll("{{last_name}}", "Johnson")
                      .replaceAll("{{company}}", "Acme Corp")
                      .replaceAll("{{broker_name}}", "Your Name")
                      .replaceAll("{{broker_phone}}", "Your Phone")
                      .replaceAll("{{broker_email}}", "your@email.com"),
                  }}
                />
              </div>
            </div>
          </div>

          {/* System Template Notice */}
          {selected.is_system && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <strong className="font-medium">System Template:</strong> This
              template is read-only and available to all users. Click "New" to
              create your own customizable version.
            </div>
          )}
        </>
      )}
    </div>
  );
}
