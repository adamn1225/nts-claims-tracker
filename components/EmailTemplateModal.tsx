"use client";
import { useState, useEffect } from "react";
import { X, Copy, Check, Mail, ExternalLink } from "lucide-react";
import { Customer } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  replaceTokens,
  getBrokerTokens,
  getCustomerTokens,
  mergeTokens,
} from "@/lib/email-template-processor";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
  is_system: boolean;
}

interface EmailTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

export default function EmailTemplateModal({
  isOpen,
  onClose,
  customer,
}: EmailTemplateModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [processedSubject, setProcessedSubject] = useState("");
  const [processedBody, setProcessedBody] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTemplateId) {
      processTemplate();
    }
  }, [selectedTemplateId, customer]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/email-templates?type=external");
      const data = await response.json();
      if (response.ok && data.templates) {
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          setSelectedTemplateId(data.templates[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const processTemplate = async () => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Get broker tokens
      const brokerTokens = await getBrokerTokens(user.id, supabase);

      // Get customer tokens
      const customerTokens = getCustomerTokens(customer);

      // Merge all tokens
      const allTokens = mergeTokens(brokerTokens, customerTokens);

      // Replace tokens in subject and body
      const subject = replaceTokens(template.subject, allTokens);
      const body = replaceTokens(template.body, allTokens);

      setProcessedSubject(subject);
      setProcessedBody(body);
    } catch (error) {
      console.error("Error processing template:", error);
    }
  };

  const copySubject = () => {
    navigator.clipboard.writeText(processedSubject).then(() => {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    });
  };

  const copyBody = () => {
    // Copy HTML without wrapping tags for pasting into Outlook
    const plainText = processedBody
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "");

    navigator.clipboard.writeText(plainText).then(() => {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    });
  };

  const openInOutlook = async () => {
    // Remove HTML tags for plain text
    const plainText = processedBody
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "");

    const emailContent = `To: ${customer.email || ""}\nSubject: ${processedSubject}\n\n${plainText}`;
    
    const { copyToClipboard } = await import("@/lib/clipboard-utils");
    await copyToClipboard(emailContent, "Email draft copied to clipboard");
  };

  if (!isOpen) return null;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-orange-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Email Template
              </h2>
              <p className="text-sm text-slate-600">
                For {customer.business_name || getCustomerDisplayName(customer) || "Unknown Customer"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto p-6"
          style={{ maxHeight: "calc(90vh - 140px)" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
                <p className="text-sm text-slate-600">Loading templates...</p>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm text-amber-800">
                No templates found.{" "}
                <a
                  href="/dashboard/tools"
                  className="font-medium underline hover:text-amber-900"
                >
                  Create one in Tools
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Template Selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_system ? "(System)" : ""}
                      {t.description ? ` - ${t.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Subject Line
                  </label>
                  <button
                    onClick={copySubject}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    {copiedSubject ? (
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
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {processedSubject}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Email Body
                  </label>
                  <button
                    onClick={copyBody}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    {copiedBody ? (
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
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div
                    className="prose prose-sm max-w-none text-slate-800"
                    dangerouslySetInnerHTML={{ __html: processedBody }}
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  <strong className="font-medium">How to use:</strong> Click
                  "Copy" buttons above to copy the subject and body, then paste
                  into your Outlook email. Or click "Open in Outlook" below to
                  auto-fill (if Outlook is your default email client).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          {customer.email && (
            <button
              onClick={openInOutlook}
              disabled={!selectedTemplateId}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Outlook
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
