"use client";

import { useEffect, useState, useRef } from "react";
import { Save, Eye, Send, Info, Trash2, Plus, ChevronLeft, ChevronRight, Layers, Smile, Code, Edit3 } from "lucide-react";
import { EMAIL_COMPONENTS, STARTER_TEMPLATE, EmailComponent } from "@/lib/email-components";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
  is_system: boolean;
}

const tokenHints = [
  "{{first_name}}",
  "{{last_name}}",
  "{{company}}",
  "{{broker_name}}",
  "{{broker_phone}}",
  "{{broker_email}}",
  "{{lanes}}",
  "{{frequency}}",
  "{{next_steps}}",
];

export default function EmailTemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showComponents, setShowComponents] = useState(true);
  const [compiledHtml, setCompiledHtml] = useState<string>("");
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "layout" | "content" | "freight">("all");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editMode, setEditMode] = useState<"code" | "simple">("code");
  const [simpleEditContent, setSimpleEditContent] = useState<{ section: string; content: string; originalIndex: number }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentBroker, setCurrentBroker] = useState<any>(null);
  const [templateFilter, setTemplateFilter] = useState<"custom" | "system">("custom");

  const selected = templates.find((t) => t.id === selectedId);

  // Filter templates based on selected tab
  const filteredTemplates = templates.filter((t) => {
    if (templateFilter === "system") {
      return t.is_system === true;
    } else {
      return t.is_system === false;
    }
  });

  useEffect(() => {
    loadTemplates();
    loadCurrentBroker();
  }, []);

  // Auto-compile MJML to HTML preview (debounced)
  useEffect(() => {
    if (!selected?.body) return;

    const timeout = setTimeout(() => {
      compileMJML(selected.body);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeout);
  }, [selected?.body]);

  // Parse MJML to simple sections when switching to simple mode
  useEffect(() => {
    if (editMode === "simple" && selected?.body) {
      console.log('Switching to simple mode, parsing MJML...');
      const sections = parseToSimpleEdit(selected.body);
      setSimpleEditContent(sections);
      console.log('Set simple edit content:', sections);
    }
  }, [editMode, selected?.body]);

  const compileMJML = async (mjmlCode: string) => {
    setCompiling(true);
    setCompileError(null);
    
    // Check if it's HTML (not MJML)
    const isHtml = mjmlCode.trim().startsWith("<div") || 
                   mjmlCode.trim().startsWith("<html") ||
                   mjmlCode.trim().startsWith("<!DOCTYPE") ||
                   !mjmlCode.trim().startsWith("<mjml");
    
    if (isHtml) {
      // It's already HTML, use directly
      setCompiledHtml(mjmlCode);
      setCompiling(false);
      return;
    }
    
    try {
      const response = await fetch("/api/email-templates/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjmlCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setCompiledHtml(data.html);
      } else {
        setCompileError(data.error || "Compilation failed");
        setCompiledHtml("");
      }
    } catch (error: any) {
      setCompileError(error.message);
      setCompiledHtml("");
    } finally {
      setCompiling(false);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/email-templates");
      
      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Expected JSON but got:", contentType);
        throw new Error("Server returned non-JSON response. Please refresh the page.");
      }
      
      const data = await response.json();
      
      if (response.ok && data.templates) {
        console.log("📧 Loaded templates:", data.templates.length);
        console.log("System templates:", data.templates.filter((t: Template) => t.is_system === true));
        console.log("Custom templates:", data.templates.filter((t: Template) => t.is_system === false));
        
        setTemplates(data.templates);
        
        // Select first template based on current filter
        if (data.templates.length > 0 && !selectedId) {
          const firstFilteredTemplate = data.templates.find((t: Template) => {
            if (templateFilter === "system") {
              return t.is_system === true;
            } else {
              return t.is_system === false || !t.is_system;
            }
          });
          
          if (firstFilteredTemplate) {
            setSelectedId(firstFilteredTemplate.id);
          }
        }
      } else {
        throw new Error(data.error || "Failed to load templates");
      }
    } catch (error: any) {
      console.error("Error loading templates:", error);
      showMessage("error", error.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentBroker = async () => {
    try {
      const response = await fetch("/api/debug/user-info");
      const data = await response.json();
      if (response.ok && data.broker) {
        setCurrentBroker(data.broker);
      }
    } catch (error) {
      console.error("Error loading broker info:", error);
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
      body: STARTER_TEMPLATE,
      description: "",
      is_system: false,
    };
    setTemplates([t, ...templates]);
    setSelectedId(id);
  };

  const insertComponent = (component: EmailComponent) => {
    if (!selected) return;

    // Check if template is HTML (not MJML)
    const isHtml = selected.body.trim().startsWith("<div") || 
                   selected.body.trim().startsWith("<html") ||
                   selected.body.trim().startsWith("<!DOCTYPE") ||
                   !selected.body.trim().startsWith("<mjml");
    
    if (isHtml) {
      showMessage("error", "Cannot insert MJML components into HTML templates. Switch to Code mode to edit manually.");
      return;
    }

    // Insert component before closing </mj-body> tag
    const bodyEndIndex = selected.body.lastIndexOf("</mj-body>");
    if (bodyEndIndex !== -1) {
      const newBody =
        selected.body.substring(0, bodyEndIndex) +
        "\n" +
        component.mjml +
        "\n\n" +
        selected.body.substring(bodyEndIndex);
      update({ body: newBody });
      showMessage("success", `${component.label} component added!`);
    } else {
      showMessage("error", "Invalid MJML structure - missing </mj-body>");
    }
  };

  const filteredComponents =
    selectedCategory === "all"
      ? EMAIL_COMPONENTS
      : EMAIL_COMPONENTS.filter((c) => c.category === selectedCategory);

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
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage("success", "Template saved successfully!");
        // Reload templates to get the real ID from database
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
    if (!selected) {
      return;
    }

    setShowDeleteModal(false);

    try {
      const response = await fetch(
        `/api/admin/email-templates?id=${selected.id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        showMessage("success", "Template deleted");
        setSelectedId("");
        await loadTemplates();
      } else {
        const data = await response.json();
        const errorMsg = data.error || "Failed to delete template";
        showMessage("error", errorMsg);
      }
    } catch (error: any) {
      showMessage("error", error.message || "Failed to delete template");
    }
  };

  const sendTest = async () => {
    if (!selected) return;
    const to = prompt("Send test to:", "");
    if (!to) return;

    // Check if it's HTML or MJML
    const isMjml = selected.body.trim().startsWith("<mjml");
    let html = selected.body;

    // Compile MJML to HTML if needed
    if (isMjml) {
      const response = await fetch("/api/email-templates/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjmlCode: selected.body }),
      });

      if (!response.ok) {
        showMessage("error", "Failed to compile MJML");
        return;
      }

      const data = await response.json();
      html = data.html;
    }

    // Replace tokens with demo data
    const subject = selected.subject
      .replaceAll("{{first_name}}", currentBroker?.first_name || "Alex")
      .replaceAll("{{broker_name}}", currentBroker ? `${currentBroker.first_name} ${currentBroker.last_name}` : "Demo Broker");

    const body = html
      .replaceAll("{{first_name}}", currentBroker?.first_name || "Alex")
      .replaceAll("{{company}}", "Acme Corp")
      .replaceAll("{{broker_name}}", currentBroker ? `${currentBroker.first_name} ${currentBroker.last_name}` : "Demo Broker")
      .replaceAll("{{broker_phone}}", currentBroker?.phone || "(555) 010-0000")
      .replaceAll("{{broker_email}}", currentBroker?.email || "demo@ntslogistics.com");

    const emailContent = `To: ${to}\nSubject: ${subject}\n\n${body}`;

    const { copyToClipboard } = await import("@/lib/clipboard-utils");
    await copyToClipboard(emailContent, "Email draft copied to clipboard");
  };

  const insertEmoji = (emojiData: any) => {
    if (!selected) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = cursorPosition;
    const emoji = emojiData.emoji;
    const newBody = 
      selected.body.substring(0, start) + 
      emoji + 
      selected.body.substring(start);

    update({ body: newBody });
    
    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + emoji.length;
      textarea.setSelectionRange(newPosition, newPosition);
      setCursorPosition(newPosition);
    }, 0);

    setShowEmojiPicker(false);
  };

  const parseToSimpleEdit = (mjmlCode: string) => {
    // Extract text content from MJML sections
    const sections: { section: string; content: string; originalIndex: number }[] = [];
    
    // Match mj-text content
    const textRegex = /<mj-text[^>]*>([\s\S]*?)<\/mj-text>/g;
    let match;
    let index = 0;
    
    while ((match = textRegex.exec(mjmlCode)) !== null) {
      const content = match[1].trim();
      
      if (content) {
        sections.push({
          section: `Section ${index + 1}`,
          content: content,
          originalIndex: index,
        });
        index++;
      }
    }
    
    console.log('Parsed sections:', sections.length, sections);
    return sections;
  };

  const applySimpleEdit = () => {
    if (!selected) return;

    // Replace each mj-text content with edited version
    let updatedMjml = selected.body;
    const textRegex = /<mj-text[^>]*>([\s\S]*?)<\/mj-text>/g;
    const matches = Array.from(selected.body.matchAll(textRegex));
    
    console.log('Applying edits, found matches:', matches.length);
    
    // Replace in reverse order to maintain indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const editData = simpleEditContent.find(s => s.originalIndex === i);
      
      if (editData && match.index !== undefined) {
        const fullMatch = match[0];
        const originalContent = match[1];
        const newFullMatch = fullMatch.replace(originalContent, editData.content);
        
        // Replace using index position
        updatedMjml = 
          updatedMjml.substring(0, match.index) + 
          newFullMatch + 
          updatedMjml.substring(match.index + fullMatch.length);
      }
    }

    update({ body: updatedMjml });
    showMessage("success", "Changes applied to MJML");
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setTemplateFilter("custom");
            // Auto-select first custom template
            const firstCustom = templates.find((t) => !t.is_system);
            setSelectedId(firstCustom?.id || "");
          }}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            templateFilter === "custom"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          Custom Templates
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold">
            {templates.filter((t) => !t.is_system).length}
          </span>
        </button>
        <button
          onClick={() => {
            setTemplateFilter("system");
            // Auto-select first system template
            const firstSystem = templates.find((t) => t.is_system);
            setSelectedId(firstSystem?.id || "");
          }}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            templateFilter === "system"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          System Templates
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {templates.filter((t) => t.is_system).length}
          </span>
        </button>
      </div>

      {/* Tab Description */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-600">
          {templateFilter === "custom" ? (
            <>
              <strong>Custom Templates:</strong> Create and manage email
              templates for broadcast campaigns. These templates use tokens like{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5">
                {"{{first_name}}"}
              </code>{" "}
              that will be replaced when sending.
            </>
          ) : (
            <>
              <strong>System Templates:</strong> Automated email templates used by
              the application (e.g., daily digest). These templates are sent
              automatically by the system and use special tokens. Admin access
              required to edit.
            </>
          )}
        </p>
      </div>

      {/* Editor Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            disabled={filteredTemplates.length === 0}
          >
            {filteredTemplates.length === 0 && (
              <option value="">
                {templateFilter === "system"
                  ? "No system templates"
                  : "No custom templates"}
              </option>
            )}
            {filteredTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templateFilter === "custom" && (
            <button
              onClick={addNew}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          )}
          {selected && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              title={selected.is_system ? "Delete system template (admin only)" : "Delete template"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setShowComponents(!showComponents)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            title={showComponents ? "Hide components" : "Show components"}
          >
            <Layers className="h-4 w-4" />
            {showComponents ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Info className="h-4 w-4" /> Use tokens:{" "}
          {tokenHints.slice(0, 5).join(", ")}
        </div>
      </div>

      {selected && (
        <>
          {/* Template Info Fields */}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Template Name
              </label>
              <input
                value={selected.name}
                onChange={(e) => update({ name: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              {selected.is_system && (
                <p className="mt-1 text-xs text-amber-600">⚠️ Editing system template name</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Description (optional)
              </label>
              <input
                value={selected.description || ""}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Brief description"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Subject
              </label>
              <input
                value={selected.subject}
                onChange={(e) => update({ subject: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              {selected.is_system && (
                <p className="mt-1 text-xs text-amber-600">⚠️ Editing system template subject</p>
              )}
            </div>
          </div>

          {/* Main Editor Layout */}
          <div className="grid gap-3 lg:grid-cols-[auto_1fr_1fr]">
            {/* Component Library Sidebar */}
            {showComponents && (
              <div className="w-full lg:w-64 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Layers className="h-4 w-4" />
                    Components
                  </div>

                  {/* Image Usage Info */}
                  {/* <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-2">
                    <p className="text-xs font-medium text-blue-900 mb-1"> Using Images:</p>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      Image URLs automatically use <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_APP_URL</code> from your environment.
                    </p>
                    <p className="text-xs text-blue-700 mt-1 italic">
                      Images from <code className="bg-blue-100 px-1 rounded">public/</code> folder work automatically!
                    </p>
                  </div> */}

                  {/* Category Filter */}
                  <div className="mb-3 flex gap-1 rounded-lg bg-white p-1">
                    {(["all", "layout", "content", "freight"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`shrink-0 rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                          selectedCategory === cat
                            ? "bg-orange-500 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Component List */}
                  <div className="max-h-125 space-y-2 overflow-y-auto">
                    {filteredComponents.map((component) => {
                      const Icon = component.icon;
                      return (
                        <button
                          key={component.id}
                          onClick={() => insertComponent(component)}
                          className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition-all hover:border-orange-300 hover:bg-orange-50"
                          title={component.description}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-orange-600" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-900">
                              {component.label}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                              {component.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* MJML Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700">
                  {editMode === "code" ? "MJML/HTML Code" : "Simple Editor"}
                  <span className="ml-2 font-normal text-slate-500">(Auto-saves on edit)</span>
                </label>
                <div className="flex gap-2">
                  {/* Edit Mode Toggle */}
                  <div className="flex rounded-lg bg-slate-100 p-0.5">
                    <button
                      onClick={() => setEditMode("code")}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        editMode === "code"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Code Editor (MJML)"
                    >
                      <Code className="h-3 w-3" />
                      Code
                    </button>
                    <button
                      onClick={() => setEditMode("simple")}
                      disabled={
                        selected?.body.trim().startsWith("<div") ||
                        selected?.body.trim().startsWith("<html") ||
                        selected?.body.trim().startsWith("<!DOCTYPE") ||
                        !selected?.body.trim().startsWith("<mjml")
                      }
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        editMode === "simple"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title={
                        selected?.body.trim().startsWith("<mjml")
                          ? "Simple Text Editor"
                          : "Simple mode only available for MJML templates"
                      }
                    >
                      <Edit3 className="h-3 w-3" />
                      Simple
                    </button>
                  </div>
                  
                  {/* Emoji Picker Button (Code mode only) */}
                  {editMode === "code" && (
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        title="Insert Emoji"
                      >
                        <Smile className="h-3 w-3" />
                        😀
                      </button>
                      {showEmojiPicker && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowEmojiPicker(false)}
                          />
                          <div className="absolute right-0 top-full z-20 mt-1">
                            <EmojiPicker
                              onEmojiClick={insertEmoji}
                              width={320}
                              height={400}
                              searchPlaceholder="Search emojis..."
                              previewConfig={{ showPreview: false }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Code Editor */}
              {editMode === "code" && (
                <>
                  <textarea
                    ref={textareaRef}
                    value={selected.body}
                    onChange={(e) => {
                      update({ body: e.target.value });
                      setCursorPosition(e.target.selectionStart);
                    }}
                    onSelect={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      setCursorPosition(target.selectionStart);
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      setCursorPosition(target.selectionStart);
                    }}
                    rows={20}
                    className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    placeholder="<mjml>...</mjml> or <html>...</html>"
                  />
                  {selected.is_system && (
                    <p className="text-xs text-amber-600">⚠️ Editing system template code - changes affect all users</p>
                  )}
                </>
              )}
              
              {/* Simple Editor */}
              {editMode === "simple" && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  {simpleEditContent.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No text sections found. Switch to Code editor to add components.
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                        <strong>✏️ Simple Edit Mode:</strong> Edit the text content below. Formatting and layout are preserved from the MJML template.
                      </div>
                      {simpleEditContent.map((section, index) => (
                        <div key={`section-${section.originalIndex}`} className="space-y-1">
                          <label className="text-xs font-medium text-slate-700">
                            {section.section}
                          </label>
                          <textarea
                            value={section.content}
                            onChange={(e) => {
                              const updated = [...simpleEditContent];
                              updated[index] = {
                                ...updated[index],
                                content: e.target.value,
                              };
                              setSimpleEditContent(updated);
                            }}
                            rows={4}
                            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                      ))}
                      <button
                        onClick={applySimpleEdit}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
                      >
                        <Save className="h-4 w-4" />
                        Apply Changes to Template
                      </button>
                    </>
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                {editMode === "code" && (
                  <button
                    onClick={saveTemplate}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : selected.is_system ? "Save System Template" : "Save Template"}
                  </button>
                )}
                <button
                  onClick={sendTest}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <Send className="h-4 w-4" /> Copy Test Email
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-medium text-slate-700">
                  Live Preview
                </span>
                {compiling && (
                  <span className="text-xs text-orange-600">Compiling...</span>
                )}
              </div>
              <div className="max-h-150 overflow-y-auto p-4">
                {compileError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <strong className="block font-medium mb-1">Compilation Error:</strong>
                    {compileError}
                  </div>
                ) : compiledHtml ? (
                  <>
                    <div className="mb-3 border-b border-slate-200 pb-2">
                      <p className="text-xs text-slate-500">Subject:</p>
                      <p className="text-sm font-medium">
                        {selected.subject
                          .replaceAll("{{first_name}}", currentBroker?.first_name || "Alex")
                          .replaceAll("{{broker_name}}", currentBroker ? `${currentBroker.first_name} ${currentBroker.last_name}` : "Demo Broker")}
                      </p>
                    </div>
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{
                        __html: compiledHtml
                          .replaceAll("{{first_name}}", currentBroker?.first_name || "Alex")
                          .replaceAll("{{company}}", "Acme Corp")
                          .replaceAll("{{broker_name}}", currentBroker ? `${currentBroker.first_name} ${currentBroker.last_name}` : "Demo Broker")
                          .replaceAll("{{broker_phone}}", currentBroker?.phone || "(555) 010-0000")
                          .replaceAll("{{broker_email}}", currentBroker?.email || "demo@ntslogistics.com")
                          .replaceAll("{{lanes}}", "CA to TX")
                          .replaceAll("{{frequency}}", "Weekly")
                          .replaceAll("{{next_steps}}", "Send pricing quote"),
                      }}
                    />
                  </>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    Preview will appear here...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* System Template Notice */}
          {selected.is_system && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong className="font-medium">⚠️ System Template:</strong> This
              template is available to all users. Editing or deleting it will affect everyone. Create a copy by
              clicking "New" to make your own custom version.
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <strong className="font-medium">💡 Email Template Editor:</strong> Supports both MJML and HTML templates. MJML templates are responsive by default. Click components on the left to insert MJML sections.
            <br />
            <strong className="mt-2 block font-medium">✏️ Two Edit Modes:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1 text-xs">
              <li><strong>Code:</strong> Full MJML/HTML editor with emoji picker for power users</li>
              <li><strong>Simple:</strong> Form-based text editing for non-technical users (MJML only)</li>
            </ul>
            <strong className="mt-2 block font-medium">📸 Available Public Images:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1 text-xs font-mono">
              <li>/NTS-logo.svg</li>
              <li>/nts-header01.png</li>
              <li>/nts-footer%2001.png <span className="font-sans italic">(note: URL encoded space)</span></li>
            </ul>
            <p className="mt-1 text-xs">
              <strong>Auto-configured:</strong> Image components use <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_APP_URL</code> automatically.
            </p>
            <div className="mt-2 rounded border border-blue-300 bg-blue-100 px-2 py-1 text-xs">
              <strong>💡 Tip:</strong> Click "+ New" to create a custom template. System templates can be edited but affect all users.
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Template</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6 rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete <strong className="font-semibold text-slate-900">"{selected.name}"</strong>?
              </p>
              {selected.is_system ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">⚠️ WARNING: System Template</p>
                  <p className="mt-1 text-xs text-amber-800">
                    This is a system template. Deleting it may affect automated emails and notifications. Consider editing it instead of deleting.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  This template will be permanently removed from the system.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteTemplate}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
