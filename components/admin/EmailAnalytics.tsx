"use client";

import { useEffect, useState } from "react";
import { Mail, CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";

interface EmailStat {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface RecentEmail {
  id: string;
  to: string;
  subject: string;
  status: "sent" | "failed" | "pending";
  provider: string;
  timestamp: string;
}

export default function EmailAnalytics() {
  const [stats, setStats] = useState<EmailStat>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  });
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch real data from API
    // For now, using mock data
    setTimeout(() => {
      setStats({
        total: 247,
        sent: 239,
        failed: 5,
        pending: 3,
      });

      setRecentEmails([
        {
          id: "1",
          to: "anoah1225@gmail.com",
          subject: "📌 MEDIUM: Task Reminder: Follow up with ABC Corp",
          status: "sent",
          provider: "SendGrid",
          timestamp: new Date().toISOString(),
        },
        {
          id: "2",
          to: "teammember@example.com",
          subject: "🚨 URGENT: Task Reminder: Decision Day - XYZ Company",
          status: "sent",
          provider: "SendGrid",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);

      setLoading(false);
    }, 500);
  }, []);

  const successRate =
    stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : "0.0";

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-500">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Total Emails
            </span>
            <Mail className="h-5 w-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">
              Sent Successfully
            </span>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-900">{stats.sent}</div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-red-700">Failed</span>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-900">{stats.failed}</div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">
              Success Rate
            </span>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-900">{successRate}%</div>
        </div>
      </div>

      {/* Recent Emails Table */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          Recent Email Activity
        </h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                  Recipient
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {recentEmails.map((email) => (
                <tr key={email.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {email.status === "sent" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Sent
                      </span>
                    )}
                    {email.status === "failed" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </span>
                    )}
                    {email.status === "pending" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {email.to}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {email.subject}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {email.provider}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(email.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Performance */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          Provider Performance (Last 30 Days)
        </h3>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-900">SendGrid API</span>
              <span className="text-sm text-slate-600">234 / 237 sent</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-green-500"
                style={{ width: "98.7%" }}
              ></div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              98.7% success rate
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-900">Mailjet</span>
              <span className="text-sm text-slate-600">Not configured</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-slate-300"
                style={{ width: "0%" }}
              ></div>
            </div>
            <div className="mt-1 text-xs text-slate-500">N/A</div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>📊 Analytics Note:</strong> Email delivery tracking helps admins
        monitor system health. High success rates mean your notifications are
        reaching teamMembers reliably. If you see failures, check your email
        provider configuration.
      </div>
    </div>
  );
}
