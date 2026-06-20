"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Mail,
  Users,
  User,
  AlertCircle,
  CheckCircle,
  FileText,
  ChevronDown,
  Eye,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
  is_system: boolean;
}

type EmailBroadcastProps = {
  officeFilter?: string | null;
};

export default function EmailBroadcast({ officeFilter }: EmailBroadcastProps = {}) {
  const [emailType, setEmailType] = useState<"daily_digest" | "custom">(
    "daily_digest",
  );
  const [recipient, setRecipient] = useState<"all" | "specific" | "test">(
    "test",
  );
  const [specificEmail, setSpecificEmail] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [digestTime, setDigestTime] = useState<string>("08:00");
  const [savingDigestTime, setSavingDigestTime] = useState(false);
  const [showTimeChangeModal, setShowTimeChangeModal] = useState(false);
  const [pendingDigestTime, setPendingDigestTime] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load templates when custom email type is selected
  useEffect(() => {
    if (emailType === "custom") {
      loadTemplates();
    }
  }, [emailType]);

  // Load current digest time on mount
  useEffect(() => {
    loadDigestTime();
  }, []);

  const loadDigestTime = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("No session token available");
        return;
      }

      const response = await fetch("/api/user-preferences", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json();
      if (response.ok && data.digestTime) {
        // digest_time is stored as a wall-clock time interpreted in each user's
        // own timezone (no UTC conversion). Display it exactly as stored.
        setDigestTime(data.digestTime);
      }
    } catch (error) {
      console.error("Error loading digest time:", error);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch("/api/admin/email-templates");
      
      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Expected JSON but got:", contentType);
        throw new Error("Server returned non-JSON response. Please refresh the page.");
      }
      
      const data = await response.json();
      
      if (response.ok) {
        // Filter out system templates - they're for automated emails, not broadcasts
        const customTemplates = (data.templates || []).filter(
          (t: EmailTemplate) => !t.is_system
        );
        setTemplates(customTemplates);
        if (customTemplates.length > 0) {
          setSelectedTemplateId(customTemplates[0].id);
        }
      } else {
        throw new Error(data.error || "Failed to load templates");
      }
    } catch (error: any) {
      console.error("Error loading templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handlePreview = async () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) return;

    setLoadingPreview(true);
    setShowPreviewModal(true);

    try {
      // Check if template is MJML
      const isMJML = selectedTemplate.body.trim().startsWith('<mjml');
      
      let html = selectedTemplate.body;
      if (isMJML) {
        // Compile MJML to HTML
        const compileResponse = await fetch('/api/email-templates/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mjml: selectedTemplate.body }),
        });
        const compileData = await compileResponse.json();
        if (compileResponse.ok) {
          html = compileData.html;
        }
      }

      // Get current broker info for token replacement
      const { data: { user } } = await createClient().auth.getUser();
      if (user) {
        const { data: broker } = await createClient()
          .from('brokers')
          .select('first_name, last_name, email, phone')
          .eq('id', user.id)
          .single();

        if (broker) {
          // Replace tokens with demo data
          html = html
            .replace(/{{first_name}}/g, 'John')
            .replace(/{{company}}/g, 'Acme Logistics')
            .replace(/{{broker_name}}/g, `${broker.first_name} ${broker.last_name}`)
            .replace(/{{broker_email}}/g, broker.email || '')
            .replace(/{{broker_phone}}/g, broker.phone || '');
        }
      }

      setPreviewHtml(html);
      setPreviewSubject(selectedTemplate.subject);
    } catch (error) {
      console.error('Error generating preview:', error);
      setPreviewHtml('<p>Error loading preview</p>');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    setShowPreviewModal(false);

    try {
      const response = await fetch("/api/admin/send-email-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailType,
          recipient,
          specificEmail: recipient === "specific" ? specificEmail : undefined,
          templateId: emailType === "custom" ? selectedTemplateId : undefined,
          officeFilter, // Pass office filter to API
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: `✅ Sent ${data.emailsSent || 0} email(s) successfully!`,
        });
      } else {
        setResult({
          success: false,
          message: `❌ Error: ${data.error || "Unknown error"}`,
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `❌ Error: ${error.message}`,
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveDigestTime = async () => {
    setPendingDigestTime(digestTime);
    setShowTimeChangeModal(true);
  };

  const confirmTimeChange = async () => {
    setSavingDigestTime(true);
    setShowTimeChangeModal(false);

    try {
      const supabase = createClient();

      // digest_time is stored as a wall-clock time interpreted in each user's
      // own timezone (no UTC conversion). Setting it company-wide means every
      // user receives their digest at this local time, wherever they are.
      const localTime = pendingDigestTime;

      // Update digest_time for ALL users (global admin setting)
      const { data, error, count } = await supabase
        .from("user_preferences")
        .update({ digest_time: localTime })
        .neq("broker_id", "00000000-0000-0000-0000-000000000000") // Update all records
        .select();

      console.log("Update result:", { data, error, count, rowsAffected: data?.length });

      if (error) {
        console.error("Error updating digest time:", error);
        setResult({
          success: false,
          message: `❌ Failed to update digest time: ${error.message}`,
        });
        setSavingDigestTime(false);
        return;
      }

      const rowsUpdated = data?.length || 0;
      console.log(`Successfully updated ${rowsUpdated} user preference records`);

      setDigestTime(pendingDigestTime);
      setResult({
        success: true,
        message: `✅ Digest time updated to ${pendingDigestTime} for ${rowsUpdated} user(s). Next scheduled digest will use this time.`,
      });
    } catch (error: any) {
      console.error("Exception during digest time update:", error);
      setResult({
        success: false,
        message: `❌ Error: ${error.message}`,
      });
    } finally {
      setSavingDigestTime(false);
    }
  };

  return (
    <>
      {/* Confirmation Modal */}
      {showTimeChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-orange-100 p-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">
                  Change Daily Digest Time?
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  You're about to change the daily digest email time to{" "}
                  <strong>{pendingDigestTime}</strong> in each user's local
                  timezone.
                </p>
              </div>
            </div>

            <div className="mb-6 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">⚠️ Company-Wide Setting:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <strong>All users</strong> will receive their daily digest at{" "}
                  {pendingDigestTime} in their own local timezone (±10 min
                  window)
                </li>
                <li>
                  The cron job runs every 10 minutes (e.g., :00, :10, :20, :30,
                  :40, :50)
                </li>
                <li>
                  This changes the digest time for <strong>everyone</strong> in
                  the company
                </li>
                <li>
                  Users with email notifications disabled will still not
                  receive emails
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmTimeChange}
                disabled={savingDigestTime}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingDigestTime ? "Updating..." : "Confirm Change"}
              </button>
              <button
                onClick={() => {
                  setShowTimeChangeModal(false);
                  setDigestTime(digestTime); // Reset to current value
                }}
                disabled={savingDigestTime}
                className="rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            📧 Email Broadcast
          </h2>
          <p className="text-sm text-slate-600">
            Send emails immediately to users, bypassing the scheduled cron jobs.
            Useful for testing or urgent announcements.
          </p>
        </div>

        {/* Email Type Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Email Type
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setEmailType("daily_digest")}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                emailType === "daily_digest"
                  ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500 ring-opacity-20"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <Mail className="h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <div className="font-medium text-slate-900">Daily Digest</div>
                <div className="text-xs text-slate-600">
                  Send task overview emails (uses user's digest_time
                  preferences, but sends immediately)
                </div>
              </div>
            </button>

            <button
              onClick={() => setEmailType("custom")}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                emailType === "custom"
                  ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500 ring-opacity-20"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <FileText className="h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <div className="font-medium text-slate-900">
                  Custom Template
                </div>
                <div className="text-xs text-slate-600">
                  Send emails using custom templates with token replacement
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Template Selection (shown when custom type selected) */}
        {emailType === "custom" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select Template
            </label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="mb-2 font-medium">No templates found</p>
                <p className="text-xs">
                  Create email templates in the{" "}
                  <a
                    href="/dashboard/admin?tab=email-templates"
                    className="underline hover:text-amber-900"
                  >
                    Email Templates
                  </a>{" "}
                  tab first.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Dropdown Button */}
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-slate-300 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <div className="flex-1">
                    {selectedTemplateId ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {templates.find(t => t.id === selectedTemplateId)?.name}
                          </span>
                          {templates.find(t => t.id === selectedTemplateId)?.is_system && (
                            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              System
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Subject: {templates.find(t => t.id === selectedTemplateId)?.subject}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">Select a template...</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${
                    showDropdown ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setShowDropdown(false);
                          }}
                          className={`flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left transition-colors last:border-0 ${
                            selectedTemplateId === template.id
                              ? 'bg-orange-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {template.name}
                              </span>
                              {template.is_system && (
                                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  System
                                </span>
                              )}
                            </div>
                            {template.description && (
                              <p className="mt-0.5 text-xs text-slate-600">
                                {template.description}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              Subject: {template.subject}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Daily Digest Time Setting */}
        {emailType === "daily_digest" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-900">
              <Mail className="h-4 w-4" />
              Scheduled Digest Time
            </div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
                className="rounded-lg border bg-white border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <button
                onClick={handleSaveDigestTime}
                disabled={savingDigestTime}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingDigestTime ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>Save Time</>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              <strong>Global Setting:</strong> Change when ALL users receive
              their daily digest email. The time is applied in{" "}
              <strong>each user's own timezone</strong> (set per user in their
              settings), so everyone gets their digest at {digestTime} local
              time. The cron job runs every 10 minutes and sends within a ±10
              minute window.
            </p>
          </div>
        )}

        {/* Recipient Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Recipients
          </label>
          {officeFilter && (
            <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs font-medium text-blue-900">
                📍 Restricted to: <span className="font-bold">{officeFilter} Office</span> brokers only
              </p>
            </div>
          )}
          <div className="space-y-2">
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="recipient"
                value="test"
                checked={recipient === "test"}
                onChange={(e) => setRecipient(e.target.value as any)}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500"
              />
              <User className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  Test (Your Email Only)
                </div>
                <div className="text-xs text-slate-600">
                  Send to yourself for testing
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="recipient"
                value="specific"
                checked={recipient === "specific"}
                onChange={(e) => setRecipient(e.target.value as any)}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500"
              />
              <Mail className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  Specific User
                </div>
                <div className="text-xs text-slate-600">
                  Enter an email address
                </div>
              </div>
            </label>

            {recipient === "specific" && (
              <input
                type="email"
                value={specificEmail}
                onChange={(e) => setSpecificEmail(e.target.value)}
                placeholder="user@example.com"
                className="ml-10 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            )}

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="recipient"
                value="all"
                checked={recipient === "all"}
                onChange={(e) => setRecipient(e.target.value as any)}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500"
              />
              <Users className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  {officeFilter ? `All Users in ${officeFilter} Office` : "All Users"}
                </div>
                <div className="text-xs text-slate-600">
                  {officeFilter 
                    ? `Send to all brokers in ${officeFilter} office (respects their notification preferences)`
                    : "Send to everyone (respects their notification preferences)"
                  }
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Preview & Send Buttons */}
        <div className="flex items-center gap-3">
          {emailType === "custom" && selectedTemplateId && (
            <button
              onClick={handlePreview}
              disabled={sending}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              Preview Email
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={
              sending ||
              (recipient === "specific" && !specificEmail) ||
              (emailType === "custom" && !selectedTemplateId)
            }
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Now
              </>
            )}
          </button>

          {result && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                result.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {result.message}
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <strong className="font-medium">Important:</strong>{" "}
              {emailType === "daily_digest" ? (
                <>
                  Daily digest emails will check if users have email
                  notifications enabled. Users who have disabled email
                  notifications won't receive emails.
                </>
              ) : (
                <>
                  Custom template emails use token replacement. Available
                  tokens: {`{{first_name}}`}, {`{{company}}`},{" "}
                  {`{{broker_name}}`}, {`{{broker_phone}}`},{" "}
                  {`{{broker_email}}`}. Tokens are auto-filled from customer and
                  broker data.
                </>
              )}
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Email Preview
                  </h3>
                  <p className="text-sm text-slate-600">
                    Preview how your email will look to recipients
                  </p>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="max-h-[70vh] overflow-auto p-6">
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Subject Line */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Subject
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {previewSubject}
                      </p>
                    </div>

                    {/* Email Body */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Email Body
                      </p>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>

                    {/* Info Banner */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-800">
                        📝 <strong>Note:</strong> Tokens like {`{{first_name}}`} and {`{{company}}`} are shown with sample data. 
                        Real emails will use actual customer and broker information.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-4">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
