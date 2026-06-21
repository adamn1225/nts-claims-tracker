"use client";

import { useState } from "react";
import { Send, Mail, Settings, TrendingUp, TestTube, Clock } from "lucide-react";
import EmailBroadcast from "./EmailBroadcast";
import EmailTemplateEditor from "./EmailTemplateEditor";
import EmailSettings from "./EmailSettings";
import EmailTesting from "./EmailTesting";
import EmailAnalytics from "./EmailAnalytics";

type EmailTab = "daily-digest" | "broadcast" | "templates" | "settings" | "testing" | "analytics";

export default function EmailManagement() {
  const [activeSubTab, setActiveSubTab] = useState<EmailTab>("daily-digest");

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab("daily-digest")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeSubTab === "daily-digest"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Clock className="h-4 w-4" /> Daily Digest
        </button>
        <button
          onClick={() => setActiveSubTab("broadcast")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeSubTab === "broadcast"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Send className="h-4 w-4" /> Broadcast
        </button>
        <button
          onClick={() => setActiveSubTab("templates")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeSubTab === "templates"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Mail className="h-4 w-4" /> Templates
        </button>
        <button
          onClick={() => setActiveSubTab("settings")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeSubTab === "settings"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button
          onClick={() => setActiveSubTab("testing")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeSubTab === "testing"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <TestTube className="h-4 w-4" /> Testing
        </button>
        <button
          onClick={() => setActiveSubTab("analytics")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeSubTab === "analytics"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Analytics
        </button>
      </div>

      {/* Subtab Content */}
      <div>
        {activeSubTab === "daily-digest" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">
                📅 Daily Digest Configuration
              </h2>
              <p className="text-sm text-slate-600">
                Manage the automated daily task digest email sent to all team members each morning.
                Customize the template and set the send time.
              </p>
            </div>

            {/* Daily Digest Settings Section */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900">Send Time Configuration</h3>
              </div>
              <p className="mb-4 text-sm text-slate-600">
                The daily digest is automatically sent via pg_cron in Supabase. To edit the template,
                go to the <strong>Templates</strong> tab and select "Daily Digest" from System Templates.
              </p>
              
              {/* Link to Templates */}
              <button
                onClick={() => setActiveSubTab("templates")}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Edit Daily Digest Template
              </button>
            </div>

            {/* Info Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-2 font-medium text-slate-900">How Daily Digest Works:</h4>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Sent automatically via pg_cron job in Supabase (every 10 minutes check)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Each teamMember can set their preferred time in Notification Settings (default 8:00 AM EST)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Only sent if teamMember has tasks and hasn't received digest today</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Template uses dynamic tokens: {`{{first_name}}, {{date}}, {{task_list}}, etc.`}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Template is stored in email_templates table as a system template</span>
                </li>
              </ul>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveSubTab("testing")}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Test Daily Digest
              </button>
              <button
                onClick={() => setActiveSubTab("analytics")}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                View Email Stats
              </button>
            </div>
          </div>
        )}

        {activeSubTab === "broadcast" && <EmailBroadcast />}
        {activeSubTab === "templates" && <EmailTemplateEditor />}
        {activeSubTab === "settings" && <EmailSettings />}
        {activeSubTab === "testing" && <EmailTesting />}
        {activeSubTab === "analytics" && <EmailAnalytics />}
      </div>
    </div>
  );
}
