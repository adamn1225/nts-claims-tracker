"use client";

import { useState } from "react";
import {
  Bell,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Zap,
} from "lucide-react";

export default function EmailTesting() {
  const [loading, setLoading] = useState(false);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scheduledResult, setScheduledResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  const [hoursAhead, setHoursAhead] = useState(24);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to test notifications");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetInfo = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/notifications/test");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get notification info");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestScheduled = async () => {
    setScheduledLoading(true);
    setScheduledResult(null);
    setScheduledError(null);

    try {
      const response = await fetch("/api/admin/test-scheduled-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hours: hoursAhead }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send scheduled test emails");
      }

      setScheduledResult(data);
    } catch (err: any) {
      setScheduledError(err.message);
    } finally {
      setScheduledLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Email Testing & Diagnostics
        </h2>
        <p className="text-sm text-slate-600">
          Test the notification system and verify email delivery. Actual emails
          will be sent to your inbox!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Check Info Card */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">
              Check Overdue Tasks
            </h3>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            View information about your overdue tasks without sending any
            emails.
          </p>
          <button
            onClick={handleGetInfo}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </span>
            ) : (
              "Get Info"
            )}
          </button>
        </div>

        {/* Send Test Card */}
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-slate-900">Send Test Emails</h3>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Send actual overdue notification emails to your inbox. This tests
            the full email pipeline.
          </p>
          <button
            onClick={handleTest}
            disabled={loading}
            className="w-full rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              "Send Test"
            )}
          </button>
        </div>

        {/* Test Scheduled Emails Card */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900">
              Test Scheduled Emails
            </h3>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Send scheduled task reminder emails immediately without waiting for
            the scheduled time.
          </p>
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-slate-700">
              <Clock className="inline h-3 w-3 mr-1" />
              Look ahead (hours)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={hoursAhead}
              onChange={(e) => setHoursAhead(parseInt(e.target.value) || 24)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Send test emails for tasks due in the next {hoursAhead} hours
            </p>
          </div>
          <button
            onClick={handleTestScheduled}
            disabled={scheduledLoading}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scheduledLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              "Send Test Emails"
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Scheduled Email Error Display */}
      {scheduledError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">Scheduled Email Test Error</p>
            <p>{scheduledError}</p>
          </div>
        </div>
      )}

      {/* Scheduled Email Results */}
      {scheduledResult && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-slate-900">
              Scheduled Email Test Results
            </h4>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-600">Total Tasks</p>
                <p className="text-2xl font-bold text-slate-900">
                  {scheduledResult.results?.total || 0}
                </p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs text-green-700">Sent Successfully</p>
                <p className="text-2xl font-bold text-green-700">
                  {scheduledResult.results?.sent || 0}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">Failed</p>
                <p className="text-2xl font-bold text-red-700">
                  {scheduledResult.results?.failed || 0}
                </p>
              </div>
            </div>
            {scheduledResult.results?.errors &&
              scheduledResult.results.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-red-800">
                    Errors:
                  </p>
                  <ul className="space-y-1 text-xs text-red-700">
                    {scheduledResult.results.errors.map(
                      (error: string, idx: number) => (
                        <li key={idx} className="font-mono">
                          {error}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          {/* Success Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
            <div className="text-sm text-green-800">
              <p className="font-semibold">Success!</p>
              <p>{result.message || "Operation completed successfully"}</p>
            </div>
          </div>

          {/* TeamMember Info */}
          {result.teamMember && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Your Info</h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-slate-600">Name:</span>{" "}
                  <span className="font-medium">{result.teamMember.name}</span>
                </p>
                <p>
                  <span className="text-slate-600">Email:</span>{" "}
                  <span className="font-medium">{result.teamMember.email}</span>
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          {result.stats && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">Total Tasks</p>
                <p className="text-2xl font-bold text-slate-900">
                  {result.stats.totalTasks || 0}
                </p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm text-orange-700">Overdue</p>
                <p className="text-2xl font-bold text-orange-900">
                  {result.stats.overdue || result.stats.overdueCount || 0}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-700">Emails Sent</p>
                <p className="text-2xl font-bold text-blue-900">
                  {result.stats.emailsSent ||
                    result.emailResult?.emailsSent ||
                    0}
                </p>
              </div>
            </div>
          )}

          {/* Task List */}
          {(result.overdueTasks || result.tasks) && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-semibold text-slate-900">
                {result.overdueTasks ? "Overdue Tasks" : "Tasks"}
              </h4>
              <div className="space-y-2">
                {(result.overdueTasks || result.tasks || []).map(
                  (task: any) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                          {task.dueDate && <span>Due: {task.dueDate}</span>}
                          {task.dueTime && <span>{task.dueTime}</span>}
                          {task.customer?.business_name && (
                            <span>Customer: {task.customer.business_name}</span>
                          )}
                          {task.status && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              {task.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                )}
                {(result.overdueTasks || result.tasks || []).length === 0 && (
                  <p className="text-center text-sm text-slate-500">
                    No tasks found
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Email Result Details */}
          {result.emailResult && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-2 font-semibold text-slate-900">
                Email Delivery Result
              </h4>
              <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
                {JSON.stringify(result.emailResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
