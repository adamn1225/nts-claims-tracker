"use client";

import { useState, useEffect } from "react";
import {
  Save,
  TestTube,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface EmailProvider {
  id: "sendgrid" | "smtp" | "mailjet";
  name: string;
  enabled: boolean;
  priority: number;
}

export default function EmailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<EmailProvider[]>([
    { id: "sendgrid", name: "SendGrid API", enabled: true, priority: 1 },
    { id: "smtp", name: "SMTP (Zoho)", enabled: true, priority: 2 },
    { id: "mailjet", name: "Mailjet", enabled: false, priority: 3 },
  ]);

  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [saveMessage, setSaveMessage] = useState("");

  // SendGrid settings
  const [sendgridApiKey, setSendgridApiKey] = useState("");

  // SMTP settings
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  // Mailjet settings
  const [mailjetApiKey, setMailjetApiKey] = useState("");
  const [mailjetSecretKey, setMailjetSecretKey] = useState("");

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/email-config");
      const data = await response.json();

      if (data.success && data.config) {
        const config = data.config;
        setFromEmail(config.from_email || "");
        setFromName(config.from_name || "");
        setCcEmails(config.cc_emails?.join(", ") || "");
        setBccEmails(config.bcc_emails?.join(", ") || "");
        setProviders(config.provider_priority || providers);
        setSendgridApiKey(config.sendgrid_api_key || "");
        setSmtpHost(config.smtp_host || "");
        setSmtpPort(config.smtp_port?.toString() || "587");
        setSmtpUser(config.smtp_user || "");
        setSmtpPassword(config.smtp_password || "");
        setMailjetApiKey(config.mailjet_api_key || "");
        setMailjetSecretKey(config.mailjet_secret_key || "");
      }
    } catch (error) {
      console.error("Failed to load email config:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
  };

  const updatePriority = (id: string, direction: "up" | "down") => {
    const index = providers.findIndex((p) => p.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === providers.length - 1)
    )
      return;

    const newProviders = [...providers];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newProviders[index], newProviders[swapIndex]] = [
      newProviders[swapIndex],
      newProviders[index],
    ];
    setProviders(newProviders.map((p, i) => ({ ...p, priority: i + 1 })));
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      setTestMessage("Please enter a test email address");
      setTestStatus("error");
      return;
    }

    setTestStatus("sending");
    setTestMessage("Sending test email...");

    try {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          fromEmail,
          fromName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestStatus("success");
        setTestMessage(`Test email sent successfully via ${data.provider}!`);
      } else {
        setTestStatus("error");
        setTestMessage(data.error || "Failed to send test email");
      }
    } catch (error) {
      setTestStatus("error");
      setTestMessage("Network error sending test email");
    }

    setTimeout(() => {
      setTestStatus("idle");
      setTestMessage("");
    }, 5000);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setSaveStatus("idle");
      setSaveMessage("");

      const response = await fetch("/api/admin/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_email: fromEmail,
          from_name: fromName,
          cc_emails: ccEmails
            ? ccEmails
                .split(",")
                .map((e) => e.trim())
                .filter(Boolean)
            : [],
          bcc_emails: bccEmails
            ? bccEmails
                .split(",")
                .map((e) => e.trim())
                .filter(Boolean)
            : [],
          provider_priority: providers,
          sendgrid_api_key: sendgridApiKey,
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort),
          smtp_user: smtpUser,
          smtp_password: smtpPassword,
          smtp_secure: false,
          mailjet_api_key: mailjetApiKey,
          mailjet_secret_key: mailjetSecretKey,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSaveStatus("success");
        setSaveMessage("Email settings saved successfully!");
        // Reload config to get masked values
        await loadConfig();
      } else {
        setSaveStatus("error");
        setSaveMessage(data.error || "Failed to save settings");
      }
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage("Network error saving settings");
    } finally {
      setSaving(false);
      setTimeout(() => {
        setSaveStatus("idle");
        setSaveMessage("");
      }, 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          General Email Settings
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              From Email
            </label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="noreply@yourdomain.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              From Name
            </label>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Your Company Name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              CC (comma-separated)
            </label>
            <input
              type="email"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="manager@company.com, admin@company.com"
            />
            <p className="mt-1 text-xs text-slate-500">
              CC these emails on all outgoing notifications
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              BCC (comma-separated)
            </label>
            <input
              type="email"
              value={bccEmails}
              onChange={(e) => setBccEmails(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="archive@company.com"
            />
            <p className="mt-1 text-xs text-slate-500">
              BCC for record keeping (recipients won't see these)
            </p>
          </div>
        </div>
      </div>

      {/* Email Provider Priority */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          Email Provider Priority
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Configure which email providers to use and their fallback order. The
          system will try each enabled provider in order until one succeeds.
        </p>

        <div className="space-y-2">
          {providers.map((provider, index) => (
            <div
              key={provider.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                provider.enabled
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={() => toggleProvider(provider.id)}
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
              <div className="flex-1">
                <div className="font-medium text-slate-900">
                  {provider.name}
                </div>
                <div className="text-xs text-slate-500">
                  Priority: {provider.priority}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => updatePriority(provider.id, "up")}
                  disabled={index === 0}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => updatePriority(provider.id, "down")}
                  disabled={index === providers.length - 1}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Configuration */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          Provider Configuration
        </h3>

        {/* SendGrid */}
        <details className="mb-3 rounded-lg border border-slate-200" open>
          <summary className="cursor-pointer bg-slate-50 p-3 font-medium text-slate-900">
            SendGrid API Settings
          </summary>
          <div className="space-y-3 p-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                API Key
              </label>
              <input
                type="password"
                value={sendgridApiKey}
                onChange={(e) => setSendgridApiKey(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="SG.xxxxxxxxxxxxxxx"
              />
              <p className="mt-1 text-xs text-slate-500">
                Get your API key from{" "}
                <a
                  href="https://app.sendgrid.com/settings/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline"
                >
                  SendGrid Dashboard
                </a>
              </p>
            </div>
          </div>
        </details>

        {/* SMTP */}
        <details className="mb-3 rounded-lg border border-slate-200">
          <summary className="cursor-pointer bg-slate-50 p-3 font-medium text-slate-900">
            SMTP Settings (Zoho, Gmail, etc.)
          </summary>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Host
              </label>
              <input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="smtp.zoho.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Port
              </label>
              <input
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="587"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="your-email@domain.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password / App Password
              </label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="••••••••"
              />
            </div>
          </div>
        </details>

        {/* Mailjet */}
        <details className="rounded-lg border border-slate-200">
          <summary className="cursor-pointer bg-slate-50 p-3 font-medium text-slate-900">
            Mailjet Settings
          </summary>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                API Key
              </label>
              <input
                value={mailjetApiKey}
                onChange={(e) => setMailjetApiKey(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="Mailjet API Key"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Secret Key
              </label>
              <input
                type="password"
                value={mailjetSecretKey}
                onChange={(e) => setMailjetSecretKey(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="Mailjet Secret Key"
              />
            </div>
          </div>
        </details>
      </div>

      {/* Test Email */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          Test Email Delivery
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            placeholder="test@example.com"
          />
          <button
            onClick={sendTestEmail}
            disabled={testStatus === "sending"}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <TestTube className="h-4 w-4" />
            {testStatus === "sending" ? "Sending..." : "Send Test Email"}
          </button>
        </div>
        {testMessage && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-sm ${
              testStatus === "success"
                ? "bg-green-50 text-green-800"
                : testStatus === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
            }`}
          >
            {testStatus === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : testStatus === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : null}
            {testMessage}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Save Status Message */}
        {saveMessage && (
          <div
            className={`flex items-center gap-2 text-sm ${
              saveStatus === "success"
                ? "text-green-700"
                : saveStatus === "error"
                  ? "text-red-700"
                  : ""
            }`}
          >
            {saveStatus === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : saveStatus === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : null}
            {saveMessage}
          </div>
        )}

        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2 font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <strong>✅ Production Ready:</strong> Email settings are now stored
        securely in the database with encrypted credentials. Changes made here
        will be used by the app immediately without code changes or
        redeployment.
      </div>
    </div>
  );
}
